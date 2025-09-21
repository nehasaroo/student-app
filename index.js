import express from "express";
import studentRouter from "./studentRouter.js";

const app = express();
app.use(express.json()); // to read JSON request body

// use the router
app.use("/", studentRouter);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
