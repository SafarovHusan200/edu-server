// src/config/swagger.js

const swaggerJsdoc = require('swagger-jsdoc');

const PORT = process.env.PORT || 5000;

const idProp = { type: 'string', example: '654f1c2e8b1d2a0012a3b456' };
const timestamps = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
};

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Edu Platform API',
    version: '1.0.0',
    description:
      "Edu Platform (edu-platform.uz) uchun REST API hujjatlari. Barcha endpoint'lar `/api/v1` prefiksi ostida joylashgan.",
    contact: { name: 'Husan Safarov' },
  },
  servers: [
    { url: `http://localhost:${PORT}/api/v1`, description: 'Local server' },
    { url: 'https://api.edu-platform.uz/api/v1', description: 'Production server' },
  ],
  tags: [
    { name: 'Auth', description: "Ro'yxatdan o'tish, kirish, Telegram orqali autentifikatsiya" },
    { name: 'Users', description: "Foydalanuvchi profili va admin boshqaruvi" },
    { name: 'Categories', description: 'Kurs kategoriyalari' },
    { name: 'BookCategories', description: 'Kitob kategoriyalari' },
    { name: 'Books', description: "Kutubxona (bepul kitoblar)" },
    { name: 'Courses', description: 'Kurslar' },
    { name: 'Lessons', description: 'Darslar' },
    { name: 'Enrollment', description: "Kursga yozilish" },
    { name: 'Reviews', description: 'Kurs sharhlari' },
    { name: 'Notifications', description: 'Bildirishnomalar' },
    { name: 'Quizzes', description: "Testlar, savollar va urinishlar" },
    { name: 'Payment', description: "To'lovlar (Multicard)" },
    { name: 'Rewards', description: "Sovg'alar do'koni va almashtirishlar" },
    { name: 'Certificates', description: 'Sertifikatlar' },
    { name: 'Stats', description: "Statistika (o'qituvchi)" },
    { name: 'PromoCodes', description: 'Promokodlar' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "`Authorization: Bearer <token>` header orqali yuboriladi. Token `/auth/login` yoki `/auth/register` javobida qaytadi.",
      },
    },
    schemas: {
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          statusCode: { type: 'integer', example: 200 },
          message: { type: 'string', example: 'Muvaffaqiyatli' },
          data: { type: 'object', nullable: true },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Xatolik yuz berdi' },
        },
      },
      ValidationErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 422 },
          message: { type: 'string', example: 'Validatsiya xatosi' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'phone' },
                message: { type: 'string', example: "Telefon raqam formati noto'g'ri" },
              },
            },
          },
        },
      },
      Grade: {
        type: 'object',
        nullable: true,
        properties: {
          number: { type: 'integer', minimum: 1, maximum: 11, example: 9 },
          letter: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E', null], example: 'A' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: idProp,
          name: { type: 'string', example: 'Aliyev Vali' },
          phone: { type: 'string', example: '+998901234567' },
          telegramId: { type: 'number', nullable: true },
          telegramUsername: { type: 'string', nullable: true },
          avatar: { type: 'string', nullable: true },
          grade: { $ref: '#/components/schemas/Grade' },
          role: { type: 'string', enum: ['student', 'teacher', 'admin', 'superadmin'] },
          tarif: { type: 'string', enum: ['standart', 'premium'] },
          isVerified: { type: 'boolean' },
          isBlocked: { type: 'boolean' },
          balance: { type: 'number', description: "So'mda, hisob balansi" },
          diamonds: { type: 'integer', description: "O'yin ichi valyuta" },
          lastLogin: { type: 'string', format: 'date-time', nullable: true },
          ...timestamps,
        },
      },
      AuthPayload: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          token: { type: 'string', description: 'JWT token' },
        },
      },
      Category: {
        type: 'object',
        properties: {
          _id: idProp,
          name: { type: 'string', example: 'Matematika' },
          slug: { type: 'string', example: 'matematika' },
          description: { type: 'string' },
          icon: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          ...timestamps,
        },
      },
      BookCategory: {
        type: 'object',
        properties: {
          _id: idProp,
          name: { type: 'string', example: 'Badiiy adabiyot' },
          slug: { type: 'string', example: 'badiiy-adabiyot' },
          description: { type: 'string' },
          icon: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          ...timestamps,
        },
      },
      Book: {
        type: 'object',
        properties: {
          _id: idProp,
          title: { type: 'string' },
          author: { type: 'string' },
          description: { type: 'string' },
          category: { oneOf: [idProp, { $ref: '#/components/schemas/BookCategory' }] },
          grade: { type: 'integer', nullable: true, minimum: 1, maximum: 11 },
          uploadedBy: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          coverImage: { type: 'string', nullable: true },
          file: { type: 'string', nullable: true },
          isPublished: { type: 'boolean' },
          downloadsCount: { type: 'integer' },
          ...timestamps,
        },
      },
      Course: {
        type: 'object',
        properties: {
          _id: idProp,
          title: { type: 'string' },
          description: { type: 'string' },
          category: { oneOf: [idProp, { $ref: '#/components/schemas/Category' }] },
          teacher: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          thumbnail: { type: 'string', nullable: true },
          price: { type: 'integer', description: "Tiyinda (1 so'm = 100 tiyin), 0 = bepul" },
          isPublished: { type: 'boolean' },
          ratingAvg: { type: 'number' },
          ratingCount: { type: 'integer' },
          ...timestamps,
        },
      },
      Lesson: {
        type: 'object',
        properties: {
          _id: idProp,
          course: idProp,
          title: { type: 'string' },
          description: { type: 'string' },
          content: { type: 'string' },
          videoUrl: { type: 'string', nullable: true },
          attachments: { type: 'array', items: { type: 'string' } },
          order: { type: 'integer' },
          ...timestamps,
        },
      },
      Enrollment: {
        type: 'object',
        properties: {
          _id: idProp,
          student: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          course: { oneOf: [idProp, { $ref: '#/components/schemas/Course' }] },
          status: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
          paymentRef: { ...idProp, nullable: true },
          completedLessons: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lesson: idProp,
                completedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
          enrolledAt: { type: 'string', format: 'date-time' },
          ...timestamps,
        },
      },
      Review: {
        type: 'object',
        properties: {
          _id: idProp,
          course: idProp,
          student: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string' },
          ...timestamps,
        },
      },
      Notification: {
        type: 'object',
        properties: {
          _id: idProp,
          user: idProp,
          type: { type: 'string', enum: ['payment', 'enrollment', 'quiz', 'lesson', 'reward', 'system'] },
          title: { type: 'string' },
          message: { type: 'string' },
          isRead: { type: 'boolean' },
          meta: { type: 'object' },
          ...timestamps,
        },
      },
      Quiz: {
        type: 'object',
        properties: {
          _id: idProp,
          title: { type: 'string' },
          description: { type: 'string' },
          targetType: { type: 'string', enum: ['course', 'lesson', 'standalone'] },
          targetId: { ...idProp, nullable: true },
          createdBy: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          passingScore: { type: 'integer', minimum: 0, maximum: 100 },
          maxAttempts: { type: 'integer', minimum: 1 },
          timeLimit: { type: 'integer', description: 'Daqiqada' },
          grade: { type: 'integer', minimum: 1, maximum: 11 },
          availableFrom: { type: 'string', format: 'date-time', nullable: true },
          availableUntil: { type: 'string', format: 'date-time', nullable: true },
          isActive: { type: 'boolean' },
          ...timestamps,
        },
      },
      QuestionOption: {
        type: 'object',
        properties: {
          label: { type: 'string', example: 'A' },
          text: { type: 'string', example: "Noto'g'ri javob" },
        },
      },
      Question: {
        type: 'object',
        properties: {
          _id: idProp,
          quiz: idProp,
          text: { type: 'string' },
          type: { type: 'string', enum: ['multiple_choice', 'true_false', 'open_ended'] },
          options: { type: 'array', items: { $ref: '#/components/schemas/QuestionOption' } },
          correctAnswer: {
            description: "multiple_choice → variant indeksi (0..n), true_false → true/false, open_ended → null",
            nullable: true,
          },
          sampleAnswer: { type: 'string', nullable: true },
          points: { type: 'integer', minimum: 1 },
          order: { type: 'integer' },
          ...timestamps,
        },
      },
      QuizAttemptAnswer: {
        type: 'object',
        properties: {
          question: idProp,
          givenAnswer: { nullable: true },
          isCorrect: { type: 'boolean' },
          pointsEarned: { type: 'number' },
          feedback: { type: 'string', nullable: true },
        },
      },
      QuizAttempt: {
        type: 'object',
        properties: {
          _id: idProp,
          quiz: { oneOf: [idProp, { $ref: '#/components/schemas/Quiz' }] },
          student: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          answers: { type: 'array', items: { $ref: '#/components/schemas/QuizAttemptAnswer' } },
          totalPoints: { type: 'number' },
          earnedPoints: { type: 'number' },
          scorePercent: { type: 'number' },
          passed: { type: 'boolean' },
          diamondsAwarded: { type: 'boolean' },
          status: { type: 'string', enum: ['in_progress', 'submitted', 'reviewed'] },
          attemptNumber: { type: 'integer' },
          startedAt: { type: 'string', format: 'date-time' },
          submittedAt: { type: 'string', format: 'date-time', nullable: true },
          durationSeconds: { type: 'integer', nullable: true },
          ...timestamps,
        },
      },
      Payment: {
        type: 'object',
        properties: {
          _id: idProp,
          user: idProp,
          invoiceId: { type: 'string' },
          amount: { type: 'integer', description: 'Tiyinda' },
          purpose: { type: 'string', enum: ['wallet', 'course', 'premium', 'donation'] },
          course: { ...idProp, nullable: true },
          promoCode: { ...idProp, nullable: true },
          discountPercent: { type: 'number', nullable: true },
          status: {
            type: 'string',
            enum: ['draft', 'progress', 'billing', 'hold', 'success', 'error', 'revert'],
          },
          receiptUrl: { type: 'string', nullable: true },
          paymentTime: { type: 'string', format: 'date-time', nullable: true },
          ...timestamps,
        },
      },
      PromoCode: {
        type: 'object',
        properties: {
          _id: idProp,
          code: { type: 'string', example: 'EDU2026' },
          discountPercent: { type: 'integer', minimum: 1, maximum: 100 },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
          maxUses: { type: 'integer', nullable: true },
          usedCount: { type: 'integer' },
          isActive: { type: 'boolean' },
          ...timestamps,
        },
      },
      Reward: {
        type: 'object',
        properties: {
          _id: idProp,
          title: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'string', nullable: true },
          cost: { type: 'integer', description: 'Diamonddagi narxi' },
          stock: { type: 'integer', nullable: true, description: 'null = cheksiz' },
          isActive: { type: 'boolean' },
          ...timestamps,
        },
      },
      RewardRedemption: {
        type: 'object',
        properties: {
          _id: idProp,
          student: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          reward: { oneOf: [idProp, { $ref: '#/components/schemas/Reward' }] },
          diamondsSpent: { type: 'integer' },
          status: { type: 'string', enum: ['pending', 'delivered', 'rejected'] },
          adminNote: { type: 'string' },
          ...timestamps,
        },
      },
      Certificate: {
        type: 'object',
        properties: {
          _id: idProp,
          student: { oneOf: [idProp, { $ref: '#/components/schemas/User' }] },
          course: { oneOf: [idProp, { $ref: '#/components/schemas/Course' }] },
          certificateNumber: { type: 'string', example: 'CERT-654F1C2E8B1D' },
          pdfPath: { type: 'string' },
          issuedAt: { type: 'string', format: 'date-time' },
          ...timestamps,
        },
      },
    },
    parameters: {
      IdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: 'MongoDB ObjectId',
      },
    },
    responses: {
      Unauthorized: {
        description: "Token yo'q yoki yaroqsiz",
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Forbidden: {
        description: "Ruxsat yo'q (rol mos kelmadi)",
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFound: {
        description: 'Topilmadi',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ValidationError: {
        description: 'Validatsiya xatosi',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorResponse' } },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options = {
  definition,
  apis: [
    './src/modules/**/*.routes.js',
    './src/routes/*.js',
  ],
};

module.exports = swaggerJsdoc(options);
