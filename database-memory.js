
const bcrypt = require('bcryptjs');

const db = {
    users: [],
    courses: [],
    enrollments: [],
    transactions: [],
    certificates: []
};

let userIdCounter = 1;
let courseIdCounter = 1;
let enrollmentIdCounter = 1;
let transactionIdCounter = 1;
let certificateIdCounter = 1;


function initializeDatabase() {
    
    const orgPassword = bcrypt.hashSync('org123', 10);
    db.users.push({
        id: userIdCounter++,
        username: 'LMS Organization',
        email: 'org@lms.com',
        password: orgPassword,
        role: 'organization',
        bankAccountNumber: 'ORG001',
        bankSecret: 'org-secret',
        balance: 100000,
        createdAt: new Date().toISOString()
    });

    
    const instructors = [
        { username: 'john_doe', email: 'john@lms.com', bankAccount: 'INST001', secret: 'john-secret' },
        { username: 'jane_smith', email: 'jane@lms.com', bankAccount: 'INST002', secret: 'jane-secret' },
        { username: 'bob_wilson', email: 'bob@lms.com', bankAccount: 'INST003', secret: 'bob-secret' }
    ];

    instructors.forEach(instructor => {
        const pwd = bcrypt.hashSync('instructor123', 10);
        db.users.push({
            id: userIdCounter++,
            username: instructor.username,
            email: instructor.email,
            password: pwd,
            role: 'instructor',
            bankAccountNumber: instructor.bankAccount,
            bankSecret: instructor.secret,
            balance: 5000,
            createdAt: new Date().toISOString()
        });
    });


    const courses = [
        { title: 'Web Development Masterclass', description: 'Learn HTML, CSS, JavaScript and modern frameworks', instructorId: 2, price: 99.99, videoUrl: 'https://example.com/video1', materials: 'HTML, CSS, JS pdfs' },
        { title: 'Data Science with Python', description: 'Complete guide to data science and machine learning', instructorId: 2, price: 149.99, videoUrl: 'https://example.com/video2', materials: 'Python notebooks, datasets' },
        { title: 'Mobile App Development', description: 'Build iOS and Android apps with React Native', instructorId: 3, price: 129.99, videoUrl: 'https://example.com/video3', materials: 'React Native tutorials' },
        { title: 'Cloud Computing Fundamentals', description: 'AWS, Azure, and Google Cloud Platform basics', instructorId: 3, price: 89.99, videoUrl: 'https://example.com/video4', materials: 'Cloud platform guides' },
        { title: 'Cybersecurity Essentials', description: 'Learn to protect systems and networks', instructorId: 4, price: 119.99, videoUrl: 'https://example.com/video5', materials: 'Security best practices' }
    ];

    courses.forEach(course => {
        db.courses.push({
            id: courseIdCounter++,
            ...course,
            uploadDate: new Date().toISOString(),
            lumpSumPaid: 0
        });
    });

    console.log('✅ Database initialized with seed data');
    console.log(`   Users: ${db.users.length}`);
    console.log(`   Courses: ${db.courses.length}`);
}

const dbHelpers = {
    // Users
    createUser(userData) {
        const user = { id: userIdCounter++, ...userData, createdAt: new Date().toISOString() };
        db.users.push(user);
        return user;
    },

    findUserByEmail(email) {
        return db.users.find(u => u.email === email);
    },

    findUserById(id) {
        return db.users.find(u => u.id === id);
    },

    updateUser(id, updates) {
        const index = db.users.findIndex(u => u.id === id);
        if (index !== -1) {
            db.users[index] = { ...db.users[index], ...updates };
            return db.users[index];
        }
        return null;
    },

    // Courses
    createCourse(courseData) {
        const course = {
            id: courseIdCounter++,
            ...courseData,
            uploadDate: new Date().toISOString(),
            lumpSumPaid: 0
        };
        db.courses.push(course);
        return course;
    },

    getAllCourses() {
        return db.courses;
    },

    getCourseById(id) {
        return db.courses.find(c => c.id === parseInt(id));
    },

    getCoursesByInstructor(instructorId) {
        return db.courses.filter(c => c.instructorId === instructorId);
    },

    updateCourse(id, updates) {
        const index = db.courses.findIndex(c => c.id === parseInt(id));
        if (index !== -1) {
            db.courses[index] = { ...db.courses[index], ...updates };
            return db.courses[index];
        }
        return null;
    },

    // Enrollments
    createEnrollment(enrollmentData) {
        const enrollment = {
            id: enrollmentIdCounter++,
            ...enrollmentData,
            enrollmentDate: new Date().toISOString(),
            completed: 0,
            certificateIssued: 0
        };
        db.enrollments.push(enrollment);
        return enrollment;
    },

    findEnrollment(learnerId, courseId) {
        return db.enrollments.find(e => e.learnerId === learnerId && e.courseId === courseId);
    },

    getEnrollmentsByLearner(learnerId) {
        return db.enrollments.filter(e => e.learnerId === learnerId);
    },

    getEnrollmentById(id) {
        return db.enrollments.find(e => e.id === parseInt(id));
    },

    updateEnrollment(id, updates) {
        const index = db.enrollments.findIndex(e => e.id === parseInt(id));
        if (index !== -1) {
            db.enrollments[index] = { ...db.enrollments[index], ...updates };
            return db.enrollments[index];
        }
        return null;
    },

    // Transactions
    createTransaction(transactionData) {
        const transaction = {
            id: transactionIdCounter++,
            ...transactionData,
            transactionDate: new Date().toISOString()
        };
        db.transactions.push(transaction);
        return transaction;
    },

    getTransactionById(id) {
        return db.transactions.find(t => t.id === parseInt(id));
    },

    getTransactionsByAccount(accountNumber) {
        return db.transactions.filter(t => t.fromAccount === accountNumber || t.toAccount === accountNumber);
    },

    getPendingTransactionsByAccount(accountNumber) {
        return db.transactions.filter(t => t.toAccount === accountNumber && t.status === 'pending');
    },

    getAllTransactions() {
        return db.transactions;
    },

    updateTransaction(id, updates) {
        const index = db.transactions.findIndex(t => t.id === parseInt(id));
        if (index !== -1) {
            db.transactions[index] = { ...db.transactions[index], ...updates };
            return db.transactions[index];
        }
        return null;
    },

    // Certificates
    createCertificate(certificateData) {
        const certificate = {
            id: certificateIdCounter++,
            ...certificateData,
            issueDate: new Date().toISOString()
        };
        db.certificates.push(certificate);
        return certificate;
    },

    getCertificatesByLearner(learnerId) {
        return db.certificates.filter(c => c.learnerId === learnerId);
    },

    // Stats
    getStats() {
        return {
            totalUsers: db.users.length,
            totalCourses: db.courses.length,
            totalEnrollments: db.enrollments.length,
            totalTransactions: db.transactions.length,
            totalRevenue: db.transactions
                .filter(t => t.status === 'completed')
                .reduce((sum, t) => sum + t.amount, 0)
        };
    }
};

// Initialize
initializeDatabase();

module.exports = dbHelpers;
