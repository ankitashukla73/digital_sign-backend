const express = require("express");
const router = express.Router();
const nodeMailer = require("nodemailer");
const Document = require("../models/Document");
const auth = require("../middleware/authMiddleware");

router.post("/", auth, async (req, res) => {
  const { recipient, fileId } = req.body;
  try {
    const doc = await Document.findById(fileId);
    if (!doc) {
      return res.status(404).json({ msg: "Document Not Found" });
    }
    const downloadlink = `http://localhost:5000/${doc.signedFile}`;
    const transporter = nodeMailer.createTransport({
      service: `gmail`,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    

    //send mail
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipient,
      subject: `Your Requested Signed Document - ${doc.filename}`,
      html: `<p>Hi there,</p>
<p>Good news! A document has been signed and is ready for you.</p>
<p>You can view or download it here:</p>
<p><a href="${downloadlink}">Click to View Document</a></p>
<p>Thanks for using SignetFlow!</p>`,
    });
    res.json({ msg: "Email sent successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ msg: "Server error sending email" });
  }
});
module.exports = router;
