// utils/sendEmail.js
const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    console.log('Attempting to send email to:', options.email);
    console.log('Using SMTP_EMAIL:', process.env.SMTP_EMAIL);

    // Create transporter for Gmail
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD
        }
    });

    // Email options
    const mailOptions = {
        from: `FundFlock <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html
    };

    try {
        // Send email
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Email send failed:', error.message);
        console.error('Full error:', error);
        throw error;
    }
};

module.exports = sendEmail;