export type DegreeLevel = 'bachelor' | 'master' | 'phd';

export interface StudentProfile {
  budget: number;
  major: string;
  preferredCountry?: string;
  degreeLevel: DegreeLevel;
  intakeYear: number;
  gpa: number;
}

export interface Course {
  id: number;
  name: string;
  university: string;
  country: string;
  feesUsd: number;
  intakeMonths: string[];
  minGpa: number;
  degreeRequired: DegreeLevel;
  fieldOfStudy: string;
  rank: number;
}

export const courseCatalog: Course[] = [
  {
    "id": 1,
    "name": "BSc Computer Science",
    "university": "Massachusetts Institute of Technology",
    "country": "United States",
    "feesUsd": 58000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 1
  },
  {
    "id": 2,
    "name": "MSc Artificial Intelligence",
    "university": "Massachusetts Institute of Technology",
    "country": "United States",
    "feesUsd": 62000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 1
  },
  {
    "id": 3,
    "name": "PhD Quantum Computing",
    "university": "Massachusetts Institute of Technology",
    "country": "United States",
    "feesUsd": 60000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.9,
    "degreeRequired": "phd",
    "fieldOfStudy": "Quantum Computing",
    "rank": 1
  },
  {
    "id": 4,
    "name": "BSc Artificial Intelligence",
    "university": "Stanford University",
    "country": "United States",
    "feesUsd": 59000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 3
  },
  {
    "id": 5,
    "name": "MS Computer Science",
    "university": "Stanford University",
    "country": "United States",
    "feesUsd": 63000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 3
  },
  {
    "id": 6,
    "name": "PhD Robotics",
    "university": "Stanford University",
    "country": "United States",
    "feesUsd": 61000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.9,
    "degreeRequired": "phd",
    "fieldOfStudy": "Robotics",
    "rank": 3
  },
  {
    "id": 7,
    "name": "BA Economics",
    "university": "Harvard University",
    "country": "United States",
    "feesUsd": 57000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Economics",
    "rank": 4
  },
  {
    "id": 8,
    "name": "MS Data Science",
    "university": "Harvard University",
    "country": "United States",
    "feesUsd": 62000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 4
  },
  {
    "id": 9,
    "name": "PhD Biomedical Engineering",
    "university": "Harvard University",
    "country": "United States",
    "feesUsd": 59000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "phd",
    "fieldOfStudy": "Biomedical Engineering",
    "rank": 4
  },
  {
    "id": 10,
    "name": "BSc Electrical Engineering",
    "university": "University of California, Berkeley",
    "country": "United States",
    "feesUsd": 46000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.7,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Electrical Engineering",
    "rank": 10
  },
  {
    "id": 11,
    "name": "MS Software Engineering",
    "university": "University of California, Berkeley",
    "country": "United States",
    "feesUsd": 50000,
    "intakeMonths": [
      "August",
      "January"
    ],
    "minGpa": 3.7,
    "degreeRequired": "master",
    "fieldOfStudy": "Software Engineering",
    "rank": 10
  },
  {
    "id": 12,
    "name": "PhD Computer Science",
    "university": "University of California, Berkeley",
    "country": "United States",
    "feesUsd": 48000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.8,
    "degreeRequired": "phd",
    "fieldOfStudy": "Computer Science",
    "rank": 10
  },
  {
    "id": 13,
    "name": "BSc Information Systems",
    "university": "Carnegie Mellon University",
    "country": "United States",
    "feesUsd": 44000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.6,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Information Systems",
    "rank": 28
  },
  {
    "id": 14,
    "name": "MS Robotics",
    "university": "Carnegie Mellon University",
    "country": "United States",
    "feesUsd": 52000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.7,
    "degreeRequired": "master",
    "fieldOfStudy": "Robotics",
    "rank": 28
  },
  {
    "id": 15,
    "name": "MS Cybersecurity",
    "university": "Carnegie Mellon University",
    "country": "United States",
    "feesUsd": 51000,
    "intakeMonths": [
      "August",
      "January"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Cybersecurity",
    "rank": 28
  },
  {
    "id": 16,
    "name": "BSc Data Science",
    "university": "Columbia University",
    "country": "United States",
    "feesUsd": 56000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Data Science",
    "rank": 23
  },
  {
    "id": 17,
    "name": "MS Financial Engineering",
    "university": "Columbia University",
    "country": "United States",
    "feesUsd": 64000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "master",
    "fieldOfStudy": "FinTech",
    "rank": 23
  },
  {
    "id": 18,
    "name": "MS Computer Science",
    "university": "University of Washington",
    "country": "United States",
    "feesUsd": 38000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 63
  },
  {
    "id": 19,
    "name": "BSc Human-Computer Interaction",
    "university": "University of Washington",
    "country": "United States",
    "feesUsd": 36000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Human-Computer Interaction",
    "rank": 63
  },
  {
    "id": 20,
    "name": "MS Mechanical Engineering",
    "university": "Georgia Institute of Technology",
    "country": "United States",
    "feesUsd": 34000,
    "intakeMonths": [
      "August",
      "January"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Mechanical Engineering",
    "rank": 88
  },
  {
    "id": 21,
    "name": "BSc Cybersecurity",
    "university": "Georgia Institute of Technology",
    "country": "United States",
    "feesUsd": 33000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.4,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Cybersecurity",
    "rank": 88
  },
  {
    "id": 22,
    "name": "MS Business Analytics",
    "university": "University of Texas at Austin",
    "country": "United States",
    "feesUsd": 39000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Business Analytics",
    "rank": 72
  },
  {
    "id": 23,
    "name": "BSc Computer Science",
    "university": "New York University",
    "country": "United States",
    "feesUsd": 54000,
    "intakeMonths": [
      "September",
      "January"
    ],
    "minGpa": 3.5,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 38
  },
  {
    "id": 24,
    "name": "MS Data Science",
    "university": "New York University",
    "country": "United States",
    "feesUsd": 58000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 38
  },
  {
    "id": 25,
    "name": "BA Economics",
    "university": "University of Oxford",
    "country": "United Kingdom",
    "feesUsd": 38000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.8,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Economics",
    "rank": 3
  },
  {
    "id": 26,
    "name": "MSc Computer Science",
    "university": "University of Oxford",
    "country": "United Kingdom",
    "feesUsd": 42000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.8,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 3
  },
  {
    "id": 27,
    "name": "DPhil Information Engineering",
    "university": "University of Oxford",
    "country": "United Kingdom",
    "feesUsd": 40000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.9,
    "degreeRequired": "phd",
    "fieldOfStudy": "Electrical Engineering",
    "rank": 3
  },
  {
    "id": 28,
    "name": "BA Mathematics & Computer Science",
    "university": "University of Cambridge",
    "country": "United Kingdom",
    "feesUsd": 39000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.8,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 2
  },
  {
    "id": 29,
    "name": "MPhil Machine Learning",
    "university": "University of Cambridge",
    "country": "United Kingdom",
    "feesUsd": 44000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.9,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 2
  },
  {
    "id": 30,
    "name": "PhD Biotechnology",
    "university": "University of Cambridge",
    "country": "United Kingdom",
    "feesUsd": 41000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.9,
    "degreeRequired": "phd",
    "fieldOfStudy": "Biotechnology",
    "rank": 2
  },
  {
    "id": 31,
    "name": "BSc Computer Science",
    "university": "Imperial College London",
    "country": "United Kingdom",
    "feesUsd": 36000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 6
  },
  {
    "id": 32,
    "name": "MSc Artificial Intelligence",
    "university": "Imperial College London",
    "country": "United Kingdom",
    "feesUsd": 40000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 6
  },
  {
    "id": 33,
    "name": "MSc Financial Technology",
    "university": "Imperial College London",
    "country": "United Kingdom",
    "feesUsd": 42000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "FinTech",
    "rank": 6
  },
  {
    "id": 34,
    "name": "BSc Data Science",
    "university": "University College London",
    "country": "United Kingdom",
    "feesUsd": 34000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Data Science",
    "rank": 9
  },
  {
    "id": 35,
    "name": "MSc Software Systems",
    "university": "University College London",
    "country": "United Kingdom",
    "feesUsd": 37000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Software Engineering",
    "rank": 9
  },
  {
    "id": 36,
    "name": "PhD Computer Science",
    "university": "University College London",
    "country": "United Kingdom",
    "feesUsd": 36000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "phd",
    "fieldOfStudy": "Computer Science",
    "rank": 9
  },
  {
    "id": 37,
    "name": "BSc Cybersecurity",
    "university": "University of Edinburgh",
    "country": "United Kingdom",
    "feesUsd": 31000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Cybersecurity",
    "rank": 22
  },
  {
    "id": 38,
    "name": "MSc Data Science",
    "university": "University of Edinburgh",
    "country": "United Kingdom",
    "feesUsd": 35000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 22
  },
  {
    "id": 39,
    "name": "MSc Artificial Intelligence",
    "university": "University of Edinburgh",
    "country": "United Kingdom",
    "feesUsd": 36000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 22
  },
  {
    "id": 40,
    "name": "BSc Engineering Management",
    "university": "University of Manchester",
    "country": "United Kingdom",
    "feesUsd": 28000,
    "intakeMonths": [
      "September",
      "January"
    ],
    "minGpa": 3.1,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Engineering Management",
    "rank": 32
  },
  {
    "id": 41,
    "name": "MSc Data Analytics",
    "university": "University of Manchester",
    "country": "United Kingdom",
    "feesUsd": 32000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Business Analytics",
    "rank": 32
  },
  {
    "id": 42,
    "name": "MSc Public Health Informatics",
    "university": "King's College London",
    "country": "United Kingdom",
    "feesUsd": 31000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Public Health",
    "rank": 40
  },
  {
    "id": 43,
    "name": "BSc Business Analytics",
    "university": "University of Warwick",
    "country": "United Kingdom",
    "feesUsd": 29000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Business Analytics",
    "rank": 67
  },
  {
    "id": 44,
    "name": "MSc Management & Technology",
    "university": "University of Warwick",
    "country": "United Kingdom",
    "feesUsd": 33000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Management",
    "rank": 67
  },
  {
    "id": 45,
    "name": "BSc Data Science",
    "university": "University of Toronto",
    "country": "Canada",
    "feesUsd": 33000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Data Science",
    "rank": 21
  },
  {
    "id": 46,
    "name": "MSc Applied Computing",
    "university": "University of Toronto",
    "country": "Canada",
    "feesUsd": 37000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 21
  },
  {
    "id": 47,
    "name": "PhD Machine Learning",
    "university": "University of Toronto",
    "country": "Canada",
    "feesUsd": 29000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "phd",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 21
  },
  {
    "id": 48,
    "name": "BSc Computer Science",
    "university": "University of British Columbia",
    "country": "Canada",
    "feesUsd": 32000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 34
  },
  {
    "id": 49,
    "name": "MSc Data Science",
    "university": "University of British Columbia",
    "country": "Canada",
    "feesUsd": 35000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 34
  },
  {
    "id": 50,
    "name": "PhD Biomedical Engineering",
    "university": "University of British Columbia",
    "country": "Canada",
    "feesUsd": 28000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "phd",
    "fieldOfStudy": "Biomedical Engineering",
    "rank": 34
  },
  {
    "id": 51,
    "name": "BEng Software Engineering",
    "university": "McGill University",
    "country": "Canada",
    "feesUsd": 34000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Software Engineering",
    "rank": 30
  },
  {
    "id": 52,
    "name": "MSc Computer Science",
    "university": "McGill University",
    "country": "Canada",
    "feesUsd": 33000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 30
  },
  {
    "id": 53,
    "name": "BSc Computer Science",
    "university": "University of Waterloo",
    "country": "Canada",
    "feesUsd": 38000,
    "intakeMonths": [
      "September",
      "January"
    ],
    "minGpa": 3.6,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 112
  },
  {
    "id": 54,
    "name": "MMATH Data Science",
    "university": "University of Waterloo",
    "country": "Canada",
    "feesUsd": 36000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 112
  },
  {
    "id": 55,
    "name": "MSc Computing Science",
    "university": "University of Alberta",
    "country": "Canada",
    "feesUsd": 26000,
    "intakeMonths": [
      "September",
      "January"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 111
  },
  {
    "id": 56,
    "name": "BSc Artificial Intelligence",
    "university": "Technical University of Munich",
    "country": "Germany",
    "feesUsd": 8000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 37
  },
  {
    "id": 57,
    "name": "MSc Informatics",
    "university": "Technical University of Munich",
    "country": "Germany",
    "feesUsd": 9500,
    "intakeMonths": [
      "October",
      "April"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 37
  },
  {
    "id": 58,
    "name": "MSc Robotics & Cognition",
    "university": "Technical University of Munich",
    "country": "Germany",
    "feesUsd": 10000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Robotics",
    "rank": 37
  },
  {
    "id": 59,
    "name": "PhD Computer Science",
    "university": "Technical University of Munich",
    "country": "Germany",
    "feesUsd": 5000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.7,
    "degreeRequired": "phd",
    "fieldOfStudy": "Computer Science",
    "rank": 37
  },
  {
    "id": 60,
    "name": "BSc Data Science",
    "university": "Ludwig Maximilian University of Munich",
    "country": "Germany",
    "feesUsd": 7500,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Data Science",
    "rank": 54
  },
  {
    "id": 61,
    "name": "MSc Economics",
    "university": "Ludwig Maximilian University of Munich",
    "country": "Germany",
    "feesUsd": 8500,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Economics",
    "rank": 54
  },
  {
    "id": 62,
    "name": "MSc Scientific Computing",
    "university": "Heidelberg University",
    "country": "Germany",
    "feesUsd": 8200,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 87
  },
  {
    "id": 63,
    "name": "MSc Biomedical Engineering",
    "university": "RWTH Aachen University",
    "country": "Germany",
    "feesUsd": 9000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Biomedical Engineering",
    "rank": 106
  },
  {
    "id": 64,
    "name": "BSc Computer Engineering",
    "university": "Technical University of Berlin",
    "country": "Germany",
    "feesUsd": 7000,
    "intakeMonths": [
      "October"
    ],
    "minGpa": 3.0,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Electrical Engineering",
    "rank": 154
  },
  {
    "id": 65,
    "name": "BSc Computer Science",
    "university": "ETH Zurich",
    "country": "Switzerland",
    "feesUsd": 4000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 7
  },
  {
    "id": 66,
    "name": "MSc Data Science",
    "university": "ETH Zurich",
    "country": "Switzerland",
    "feesUsd": 4500,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.8,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 7
  },
  {
    "id": 67,
    "name": "PhD Robotics & Intelligent Systems",
    "university": "ETH Zurich",
    "country": "Switzerland",
    "feesUsd": 3000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.9,
    "degreeRequired": "phd",
    "fieldOfStudy": "Robotics",
    "rank": 7
  },
  {
    "id": 68,
    "name": "MSc Computer Science",
    "university": "EPFL",
    "country": "Switzerland",
    "feesUsd": 4200,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 36
  },
  {
    "id": 69,
    "name": "MSc Cyber Security",
    "university": "EPFL",
    "country": "Switzerland",
    "feesUsd": 4200,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Cybersecurity",
    "rank": 36
  },
  {
    "id": 70,
    "name": "BSc Analytics",
    "university": "NUS",
    "country": "Singapore",
    "feesUsd": 26000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.4,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Business Analytics",
    "rank": 8
  },
  {
    "id": 71,
    "name": "MSc Business Analytics",
    "university": "NUS",
    "country": "Singapore",
    "feesUsd": 38000,
    "intakeMonths": [
      "August",
      "January"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Business Analytics",
    "rank": 8
  },
  {
    "id": 72,
    "name": "PhD Computer Science",
    "university": "NUS",
    "country": "Singapore",
    "feesUsd": 24000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.7,
    "degreeRequired": "phd",
    "fieldOfStudy": "Computer Science",
    "rank": 8
  },
  {
    "id": 73,
    "name": "BSc Artificial Intelligence",
    "university": "Nanyang Technological University",
    "country": "Singapore",
    "feesUsd": 25000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 26
  },
  {
    "id": 74,
    "name": "MSc Financial Technology",
    "university": "Nanyang Technological University",
    "country": "Singapore",
    "feesUsd": 37000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "FinTech",
    "rank": 26
  },
  {
    "id": 75,
    "name": "BA Economics",
    "university": "University of Amsterdam",
    "country": "Netherlands",
    "feesUsd": 18000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.1,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Economics",
    "rank": 53
  },
  {
    "id": 76,
    "name": "MSc Artificial Intelligence",
    "university": "University of Amsterdam",
    "country": "Netherlands",
    "feesUsd": 21000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 53
  },
  {
    "id": 77,
    "name": "BSc Computer Science and Engineering",
    "university": "Delft University of Technology",
    "country": "Netherlands",
    "feesUsd": 19500,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 47
  },
  {
    "id": 78,
    "name": "MSc Robotics",
    "university": "Delft University of Technology",
    "country": "Netherlands",
    "feesUsd": 22000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Robotics",
    "rank": 47
  },
  {
    "id": 79,
    "name": "MSc Applied Data Science",
    "university": "Utrecht University",
    "country": "Netherlands",
    "feesUsd": 20000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 107
  },
  {
    "id": 80,
    "name": "MSc Business Analytics & Management",
    "university": "Erasmus University Rotterdam",
    "country": "Netherlands",
    "feesUsd": 23000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Management",
    "rank": 197
  },
  {
    "id": 81,
    "name": "BBA Business",
    "university": "INSEAD",
    "country": "France",
    "feesUsd": 85000,
    "intakeMonths": [
      "September",
      "January"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Management",
    "rank": 15
  },
  {
    "id": 82,
    "name": "Global Executive MBA",
    "university": "INSEAD",
    "country": "France",
    "feesUsd": 98000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Management",
    "rank": 15
  },
  {
    "id": 83,
    "name": "MSc Artificial Intelligence & Advanced Visual Computing",
    "university": "\u00c9cole Polytechnique",
    "country": "France",
    "feesUsd": 22000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 38
  },
  {
    "id": 84,
    "name": "MSc Data Science for Business",
    "university": "\u00c9cole Polytechnique",
    "country": "France",
    "feesUsd": 26000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 38
  },
  {
    "id": 85,
    "name": "BSc Computational Science",
    "university": "Sorbonne University",
    "country": "France",
    "feesUsd": 12000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 59
  },
  {
    "id": 86,
    "name": "MSc Quantum Information",
    "university": "PSL University",
    "country": "France",
    "feesUsd": 14000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Quantum Computing",
    "rank": 24
  },
  {
    "id": 87,
    "name": "BSc Computing & Software Systems",
    "university": "University of Melbourne",
    "country": "Australia",
    "feesUsd": 34000,
    "intakeMonths": [
      "February",
      "July"
    ],
    "minGpa": 3.3,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 14
  },
  {
    "id": 88,
    "name": "Master of Data Science",
    "university": "University of Melbourne",
    "country": "Australia",
    "feesUsd": 38000,
    "intakeMonths": [
      "February",
      "July"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 14
  },
  {
    "id": 89,
    "name": "PhD Computer Science",
    "university": "University of Melbourne",
    "country": "Australia",
    "feesUsd": 32000,
    "intakeMonths": [
      "February",
      "July"
    ],
    "minGpa": 3.6,
    "degreeRequired": "phd",
    "fieldOfStudy": "Computer Science",
    "rank": 14
  },
  {
    "id": 90,
    "name": "BSc Advanced Computing",
    "university": "University of Sydney",
    "country": "Australia",
    "feesUsd": 33000,
    "intakeMonths": [
      "February",
      "August"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 19
  },
  {
    "id": 91,
    "name": "Master of Cybersecurity",
    "university": "University of Sydney",
    "country": "Australia",
    "feesUsd": 36000,
    "intakeMonths": [
      "February",
      "August"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Cybersecurity",
    "rank": 19
  },
  {
    "id": 92,
    "name": "Master of Information Technology",
    "university": "UNSW Sydney",
    "country": "Australia",
    "feesUsd": 37000,
    "intakeMonths": [
      "February",
      "June",
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Information Systems",
    "rank": 19
  },
  {
    "id": 93,
    "name": "BSc Biotechnology",
    "university": "Australian National University",
    "country": "Australia",
    "feesUsd": 32000,
    "intakeMonths": [
      "February"
    ],
    "minGpa": 3.1,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Biotechnology",
    "rank": 34
  },
  {
    "id": 94,
    "name": "Master of Artificial Intelligence",
    "university": "Monash University",
    "country": "Australia",
    "feesUsd": 35000,
    "intakeMonths": [
      "February",
      "July"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 42
  },
  {
    "id": 95,
    "name": "BSc Information Science",
    "university": "University of Tokyo",
    "country": "Japan",
    "feesUsd": 11000,
    "intakeMonths": [
      "April",
      "October"
    ],
    "minGpa": 3.5,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 28
  },
  {
    "id": 96,
    "name": "MSc Computer Science",
    "university": "University of Tokyo",
    "country": "Japan",
    "feesUsd": 13000,
    "intakeMonths": [
      "April",
      "October"
    ],
    "minGpa": 3.6,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 28
  },
  {
    "id": 97,
    "name": "PhD Informatics",
    "university": "Kyoto University",
    "country": "Japan",
    "feesUsd": 12000,
    "intakeMonths": [
      "April",
      "October"
    ],
    "minGpa": 3.7,
    "degreeRequired": "phd",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 46
  },
  {
    "id": 98,
    "name": "MSc Mechanical and Intelligent Systems",
    "university": "Tokyo Institute of Technology",
    "country": "Japan",
    "feesUsd": 12500,
    "intakeMonths": [
      "April",
      "October"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Robotics",
    "rank": 91
  },
  {
    "id": 99,
    "name": "BSc Computer Science & Engineering",
    "university": "Seoul National University",
    "country": "South Korea",
    "feesUsd": 10000,
    "intakeMonths": [
      "March",
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 41
  },
  {
    "id": 100,
    "name": "MSc Artificial Intelligence",
    "university": "KAIST",
    "country": "South Korea",
    "feesUsd": 12000,
    "intakeMonths": [
      "March",
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 56
  },
  {
    "id": 101,
    "name": "PhD Robotics Program",
    "university": "KAIST",
    "country": "South Korea",
    "feesUsd": 11000,
    "intakeMonths": [
      "March",
      "September"
    ],
    "minGpa": 3.7,
    "degreeRequired": "phd",
    "fieldOfStudy": "Robotics",
    "rank": 56
  },
  {
    "id": 102,
    "name": "MSc Machine Learning",
    "university": "KTH Royal Institute of Technology",
    "country": "Sweden",
    "feesUsd": 21000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 73
  },
  {
    "id": 103,
    "name": "BSc Information & Communication Technology",
    "university": "KTH Royal Institute of Technology",
    "country": "Sweden",
    "feesUsd": 18000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Information Systems",
    "rank": 73
  },
  {
    "id": 104,
    "name": "MSc Software Engineering",
    "university": "Lund University",
    "country": "Sweden",
    "feesUsd": 19000,
    "intakeMonths": [
      "August"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Software Engineering",
    "rank": 85
  },
  {
    "id": 105,
    "name": "BA Computer Science",
    "university": "Trinity College Dublin",
    "country": "Ireland",
    "feesUsd": 24000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 81
  },
  {
    "id": 106,
    "name": "MSc Computer Science - Data Science",
    "university": "Trinity College Dublin",
    "country": "Ireland",
    "feesUsd": 27000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 81
  },
  {
    "id": 107,
    "name": "MSc Artificial Intelligence for Medicine",
    "university": "University College Dublin",
    "country": "Ireland",
    "feesUsd": 25000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Biomedical Engineering",
    "rank": 171
  },
  {
    "id": 108,
    "name": "BSc Biotechnology",
    "university": "University of Copenhagen",
    "country": "Denmark",
    "feesUsd": 22000,
    "intakeMonths": [
      "February",
      "September"
    ],
    "minGpa": 3.2,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Biotechnology",
    "rank": 107
  },
  {
    "id": 109,
    "name": "MSc Computer Science",
    "university": "University of Copenhagen",
    "country": "Denmark",
    "feesUsd": 24000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 107
  },
  {
    "id": 110,
    "name": "MSc Autonomous Systems & Robotics",
    "university": "Technical University of Denmark",
    "country": "Denmark",
    "feesUsd": 23000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.3,
    "degreeRequired": "master",
    "fieldOfStudy": "Robotics",
    "rank": 121
  },
  {
    "id": 111,
    "name": "BSc Computer Engineering",
    "university": "Politecnico di Milano",
    "country": "Italy",
    "feesUsd": 9000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.0,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 123
  },
  {
    "id": 112,
    "name": "MSc High Performance Computing",
    "university": "Politecnico di Milano",
    "country": "Italy",
    "feesUsd": 11000,
    "intakeMonths": [
      "September",
      "February"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Computer Science",
    "rank": 123
  },
  {
    "id": 113,
    "name": "MSc Artificial Intelligence",
    "university": "University of Bologna",
    "country": "Italy",
    "feesUsd": 8500,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.1,
    "degreeRequired": "master",
    "fieldOfStudy": "Artificial Intelligence",
    "rank": 154
  },
  {
    "id": 114,
    "name": "BSc Data Science",
    "university": "University of Barcelona",
    "country": "Spain",
    "feesUsd": 11000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.0,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Data Science",
    "rank": 164
  },
  {
    "id": 115,
    "name": "Master in Business Analytics & Big Data",
    "university": "IE University",
    "country": "Spain",
    "feesUsd": 39000,
    "intakeMonths": [
      "September",
      "January"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Business Analytics",
    "rank": 250
  },
  {
    "id": 116,
    "name": "BSc Computer Science",
    "university": "University of Hong Kong",
    "country": "Hong Kong",
    "feesUsd": 22000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 26
  },
  {
    "id": 117,
    "name": "MSc Financial Technology",
    "university": "University of Hong Kong",
    "country": "Hong Kong",
    "feesUsd": 31000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.5,
    "degreeRequired": "master",
    "fieldOfStudy": "FinTech",
    "rank": 26
  },
  {
    "id": 118,
    "name": "MSc Big Data Technology",
    "university": "Hong Kong University of Science and Technology",
    "country": "Hong Kong",
    "feesUsd": 29000,
    "intakeMonths": [
      "September"
    ],
    "minGpa": 3.4,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 60
  },
  {
    "id": 119,
    "name": "BSc Computer Science",
    "university": "University of Auckland",
    "country": "New Zealand",
    "feesUsd": 26000,
    "intakeMonths": [
      "February",
      "July"
    ],
    "minGpa": 3.0,
    "degreeRequired": "bachelor",
    "fieldOfStudy": "Computer Science",
    "rank": 68
  },
  {
    "id": 120,
    "name": "Master of Data Science",
    "university": "University of Auckland",
    "country": "New Zealand",
    "feesUsd": 29000,
    "intakeMonths": [
      "February",
      "July"
    ],
    "minGpa": 3.2,
    "degreeRequired": "master",
    "fieldOfStudy": "Data Science",
    "rank": 68
  }
];
