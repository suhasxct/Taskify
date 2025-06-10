import mongoose from "mongoose";
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const User = new Schema({
  email: {
    type: String,
    unique: true,
    require: true,
  },
  Refresh_token: {
    type: String,
    require: true,
  },
  history_id: {
    type: String,
    require: true,
  },
});

const UserModel = mongoose.model("user", User);
export default UserModel;
