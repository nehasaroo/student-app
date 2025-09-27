const express = require("express");
const userRouter = require("./routes/userRouter.js");
const alarmRouter = require("./routes/alarmRouter.js");
const smokeRouter = require("./routes/smokeRouter.js");
const lifecycleRouter = require("./routes/lifecycleRouter.js");
const FLSRouter = require("./routes/FLSRouter.js");
const floormapRouter = require("./routes/floormapRouter.js");
const constructionsRouter = require("./routes/constructionsRouter.js");

const app = express();
app.use(express.json()); // to read JSON request body

// use the routers
app.use("/", userRouter);
app.use("/", alarmRouter);
app.use("/smoke", smokeRouter);
app.use("/",lifecycleRouter);
app.use("/",FLSRouter);
app.use("/",floormapRouter);
app.use("/",constructionsRouter);

app.listen(8000, () => {
  console.log("Server running on http://localhost:8000");
});
