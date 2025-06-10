import express from "express";
import { google } from "googleapis";
import axios from "axios";
import cors from "cors";
import cron from "node-cron";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import mongoose from "mongoose";
import UserModel from "./schema.js";
import dotenv from dotenv;
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
const MONGO_URI =process.env.MONGO_URI;

const token = process.env.token;

const endpoint = process.env.token;

const model = process.env.model;

export async function main(subject, body) {
  const client = ModelClient(endpoint, new AzureKeyCredential(token));
  try {
    const response = await client.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: "" },
          {
            role: "user",
            content: `Does the following email seem like it is about a task or something that needs to be done? Reply only "Yes" or "No".\n\nSubject: ${subject}\n\nBody: ${body}`,
          },
        ],
        temperature: 0.8,
        top_p: 0.1,
        max_tokens: 2048,
        model: model,
      },
    });
    return response.body.choices[0].message.content;
  } catch (e) {
    console.log(e);
  }
}

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

app.get("/login", (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  });
  res.redirect(authUrl);
});

app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oAuth2Client.getToken(code);

  oAuth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  if (tokens.refresh_token) {
    const historyId = profile.data.historyId;
    const userEmail = profile.data.emailAddress;
    const resp = await UserModel.findOneAndUpdate(
      { email: userEmail },
      {
        email: userEmail,
        Refresh_token: tokens.refresh_token,
        history_id: historyId,
      },
      {
        upsert: true,
        new: true,
      }
    );
  }
  try {
    gmail.users.watch({
      userId: "me",
      requestBody: {
        labelIds: ["INBOX"],
        topicName: "projects/my-todo-app-458803/topics/MyTopic",
      },
    });
    const email = profile.data.emailAddress;
    console.log(`Started Gmail watch for:${email}`);
    res.redirect(`http://localhost:5173/success?email=${email}`);
  } catch (e) {
    console.log("Error in Watching Gmail", e);
  }
});

app.post("/webhook", async (req, res) => {
  const data = req.body.message.data;
  const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
  //   console.log(decoded.emailAddress);

  const userinfo = await UserModel.findOne({ email: decoded.emailAddress });

  if (!userinfo) {
    throw new Error("User Not Found in DB");
  }
  if (!userinfo.Refresh_token) {
    throw new Error(`No Refresh Token For User ${decoded.emailAddress}`);
  }

  const rt = userinfo.Refresh_token;
  const hid = userinfo.history_id;
  res.status(200).end();
  await addingtask(decoded.emailAddress, rt, hid);
});

async function addingtask(email, rt, hid) {
  try {
    const userOAuth2Client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI
    );
    userOAuth2Client.setCredentials({ refresh_token: rt });

    const accessTokenResponse = await userOAuth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      throw new Error("Unable to create a access Token");
    }

    const gmailClient = google.gmail({ version: "v1", auth: userOAuth2Client });

    const historyRes = await gmailClient.users.history.list({
      userId: "me",
      startHistoryId: hid,
      historyTypes: ["messageAdded"],
    });

    if (historyRes.data.historyId) {
      const lastHistoryId = historyRes.data.historyId;

      await UserModel.updateOne(
        { email: email },
        { history_id: lastHistoryId }
      );
    }

    const history = historyRes.data.history || [];

    if (history.length === 0) {
      return;
    }

    for (const historyItem of history) {
      for (const msg of historyItem.messages || []) {
        const fullMsg = await gmailClient.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        const subject = fullMsg.data.payload.headers.find(
          (h) => h.name === "Subject"
        );
        const bodyData = fullMsg.data.payload.parts?.find(
          (part) => part.mimeType === "text/plain"
        )?.body?.data;

        const decodedBody = bodyData
          ? Buffer.from(bodyData, "base64").toString("utf-8")
          : "No plain text body found";

        const listsRes = await axios.get(
          "https://tasks.googleapis.com/tasks/v1/users/@me/lists",
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const taskLists = listsRes.data.items;
        const taskListId = taskLists[0].id;
        // console.log("Email subject:", subject?.value);
        // console.log("Email body:", decodedBody);

        const isTask = await main(subject?.value, decodedBody);

        // console.log(isTask);

        await gmailClient.users.messages.modify({
          userId: "me",
          id: msg.id,
          requestBody: {
            removeLabelIds: ["UNREAD"],
          },
        });

        if (isTask.trim() === "Yes") {
          const taskData = {
            title: subject.value,
            notes: decodedBody,
            status: "needsAction",
          };

          await axios.post(
            `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`,
            taskData,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          //   console.log("Task Added Successfully");
        } else {
          //   console.log("Task Not Added");
        }
      }
    }
  } catch (error) {
    console.error("No Refresh Token");
  }
}

// cron.schedule("*/10 * * * *", async () => {
//   await addingtask();
// });

app.get("/logout", async (req, res) => {
  const email = req.query.email;
  const user = await UserModel.findOne({ email: email });
  const userOAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
  userOAuth2Client.setCredentials({ refresh_token: user.Refresh_token });

  const gmailClient = google.gmail({
    version: "v1",
    auth: userOAuth2Client,
  });

  try {
    await gmailClient.users.stop({ userId: "me" });
    console.log(`Stopped Gmail watch for: ${user.email}`);
  } catch (e) {
    console.error(`Failed to stop watch for: ${user.email}`, e.message);
  }
  res.redirect(`http://localhost:5173/`);
});

async function connect() {
  try {
    await mongoose.connect(MONGO_URI);
    app.listen(3000);
  } catch (e) {
    console.log("Error in Connecting DataBase");
  }
}
connect();
