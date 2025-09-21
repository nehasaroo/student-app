import express from "express";
import { addStudent, getAllStudents, getStudentById } from "./studentController.js";

const router = express.Router();

router.post("/students", addStudent);
router.get("/students", getAllStudents);
router.get("/students/:id", getStudentById);

export default router;
