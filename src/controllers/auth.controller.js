const User = require('../models/user.model');

// @descr   Register
// @route   POST /api/v1/auth/register
// @Access  Public
exports.register = async (req, reply) => {
  try {
    const { name, email, password, phone } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return reply.status(400).send({
        success: false,
        message: 'User already exists',
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
    });

    const token = user.generateJwtToken();

    reply.status(201).send({
      success: true,
      data: user,
      token,
    });
  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// @descr   Login
// @route   POST /api/v1/auth/login
// @Access  Public
exports.login = async (req, reply) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return reply.status(400).send({
        message: 'Phone va password kerak',
      });
    }

    const user = await User.findOne({ phone }).select('+password');

    if (!user) {
      return reply.status(401).send({
        message: "Phone yoki password noto'g'ri",
      });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return reply.status(401).send({
        message: "Email yoki password noto'g'ri",
      });
    }

    const token = user.generateJwtToken();

    reply.send({
      success: true,
      user,
      token,
    });
  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message,
    });
  }
};

// @descr   Get current user
// @route   GET /api/v1/auth/me
// @Access  Private
exports.getMe = async (req, reply) => {
  console.log(req.user);

  try {
    const user = await User.findById(req.user.id);

    reply.send({
      success: true,
      user,
    });
  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message,
    });
  }
};
