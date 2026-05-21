import jwt from "jsonwebtoken";

const getSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Add it to server/.env.");
  }

  return process.env.JWT_SECRET;
};

export const generateToken = (userId) =>
  jwt.sign({ userId }, getSecret(), {
    expiresIn: "7d"
  });

export const verifyToken = (token) => jwt.verify(token, getSecret());
