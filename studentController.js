let students = [];

export const addStudent = (req, res) => {
  const { name, age } = req.body;
  const newStudent = { id: students.length + 1, name, age };
  students.push(newStudent);
  res.status(201).json(newStudent);
};

export const getAllStudents = (req, res) => {
  res.json(students);
};

export const getStudentById = (req, res) => {
  const student = students.find(s => s.id == req.params.id);
  if (!student) {
    return res.status(404).json({ message: "Student not found" });
  }
  res.json(student);
};
