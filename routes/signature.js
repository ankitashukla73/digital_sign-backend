const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const auth = require("../middleware/authMiddleware");
const Signature = require("../models/Signature");
const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const Document = require("../models/Document");
const fontkit = require("@pdf-lib/fontkit");
// For Aduit Log
const captureIP = require("../middleware/captureIP");

router.post("/place", auth, captureIP, async (req, res) => {
  try {
    const {
      fileId,
      pageNumber,
      xCoordinate,
      yCoordinate,
      signature,
      font,
      renderedPageHeight,
      renderedPageWidth,
    } = req.body;

    // Enhanced validation
    if (
      !fileId ||
      pageNumber == null ||
      xCoordinate == null ||
      yCoordinate == null ||
      !signature ||
      renderedPageHeight == null
    ) {
      return res.status(400).json({
        success: false,
        msg: "Missing required fields",
        required: {
          fileId: !!fileId,
          pageNumber: pageNumber != null,
          xCoordinate: xCoordinate != null,
          yCoordinate: yCoordinate != null,
          signature: !!signature,
          renderedPageHeight: renderedPageHeight != null,
        },
      });
    }

    // Convert and validate numbers
    const x = parseFloat(xCoordinate);
    const y = parseFloat(yCoordinate);
    const renderedHeight = parseFloat(renderedPageHeight);

    if (isNaN(x) || isNaN(y) || isNaN(renderedHeight)) {
      return res.status(400).json({
        success: false,
        msg: "Invalid numeric values",
        details: {
          xCoordinate: xCoordinate,
          yCoordinate: yCoordinate,
          renderedPageHeight: renderedPageHeight,
        },
      });
    }

    // Get document and verify existence
    const document = await Document.findById(fileId);
    if (!document) {
      return res
        .status(404)
        .json({ success: false, msg: "Document not found" });
    }

    // Load PDF and verify page
    const pdfPath = path.join(__dirname, "..", document.filepath);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    if (pageNumber < 1 || pageNumber > pages.length) {
      return res.status(400).json({
        success: false,
        msg: "Invalid page number",
        pageCount: pages.length,
      });
    }

    const page = pages[pageNumber - 1];
    const pdfPageHeight = page.getHeight();
    const pdfPageWidth = page.getWidth();

    // Calculate scaling factors
    const heightScale = pdfPageHeight / renderedHeight;
    let widthScale = heightScale; // Assume proportional scaling

    if (renderedPageWidth) {
      widthScale = pdfPageWidth / parseFloat(renderedPageWidth);
    }

    // Convert coordinates
    const pdfX = x * widthScale;
    const pdfY = pdfPageHeight - y * heightScale; // Convert from top-left to bottom-left origin

    // Boundary checking
    if (pdfX < 0 || pdfX > pdfPageWidth || pdfY < 0 || pdfY > pdfPageHeight) {
      return res.status(400).json({
        success: false,
        msg: "Signature position outside page bounds",
        bounds: {
          x: { min: 0, max: pdfPageWidth, value: pdfX },
          y: { min: 0, max: pdfPageHeight, value: pdfY },
        },
      });
    }

    // Remove previous signatures
    await Signature.deleteMany({
      file: fileId,
      signer: req.user,
    });
    console.log(req.signerIp);

    // Create new signature
    const newSignature = new Signature({
      file: fileId,
      signer: req.user,
      pageNumber,
      xCoordinate: x,
      yCoordinate: y,
      signature,
      font,
      pdfPageHeight,
      pdfPageWidth,
      renderedPageHeight: renderedHeight,
      renderedPageWidth: renderedPageWidth
        ? parseFloat(renderedPageWidth)
        : null,
      ipAddress: req.signerIp,
      status: "pending",
    });

    await newSignature.save();

    res.json({
      success: true,
      msg: "Signature placed successfully",
      data: {
        pdfCoordinates: { x: pdfX, y: pdfY },
        browserCoordinates: { x, y },
        pageDimensions: {
          pdf: { width: pdfPageWidth, height: pdfPageHeight },
          rendered: { height: renderedHeight, width: renderedPageWidth },
        },
        scaleFactors: { width: widthScale, height: heightScale },
      },
    });
  } catch (error) {
    console.error("Signature placement error:", error);
    res.status(500).json({
      success: false,
      msg: "Internal server error",
      error: error.message,
    });
  }
});

// GET all signatures for a specific file
router.get("/file/:fileId", auth, async (req, res) => {
  try {
    const signatures = await Signature.find({
      file: req.params.fileId,
      status: "pending",
    });
    res.json(signatures);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Failed to fetch signatures" });
  }
});

// New Finalize Singed PDF
router.post("/finalize", auth, async (req, res) => {
  try {
    const { fileId } = req.body;

    // Input validation
    if (!fileId) {
      return res.status(400).json({ msg: "Missing file ID" });
    }

    // Fetch document and signatures
    const document = await Document.findById(fileId);
    if (!document) {
      return res.status(404).json({ msg: "Document not found" });
    }

    const signatures = await Signature.find({ 
      file: fileId, 
      status: { $in: ["pending", "signed"] } 
    });

    // Load original PDF
    const originalPath = path.join(__dirname, "..", document.filepath);
    const existingPdfBytes = fs.readFileSync(originalPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // Load fonts
    const fontPaths = {
      "Great Vibes": "GreatVibes-Regular.ttf",
      "Dancing Script": "DancingScript-VariableFont_wght.ttf",
      "Pacifico": "Pacifico-Regular.ttf",
      "Satisfy": "Satisfy-Regular.ttf",
      "Shadows Into Light": "ShadowsIntoLight-Regular.ttf",
      "Caveat": "Caveat-VariableFont_wght.ttf",
      "Homemade Apple": "HomemadeApple-Regular.ttf",
      "Indie Flower": "IndieFlower-Regular.ttf"
    };

    const availableFonts = {};
    for (const [fontName, fontFile] of Object.entries(fontPaths)) {
      try {
        availableFonts[fontName] = fs.readFileSync(
          path.join(__dirname, "..", "fonts", fontFile)
        );
      } catch (err) {
        console.warn(`Could not load font ${fontName}:`, err);
      }
    }

    // Process each signature
    const pages = pdfDoc.getPages();
    for (const sig of signatures) {
      const pageIndex = sig.pageNumber - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const pdfHeight = page.getHeight();
        const pdfWidth = page.getWidth();

        // Use stored scaling factors if available
        const widthScale = sig.scaleFactors?.width || 
          (sig.renderedPageWidth ? pdfWidth / sig.renderedPageWidth : 1);
        const heightScale = sig.scaleFactors?.height || 
          pdfHeight / (sig.renderedPageHeight || pdfHeight);

        // Convert coordinates (matches placement logic exactly)
        const pdfX = sig.xCoordinate * widthScale;
        const pdfY = pdfHeight - (sig.yCoordinate * heightScale);

        // Debug logging
        console.log('Applying signature:', {
          signatureId: sig._id,
          page: sig.pageNumber,
          browserCoords: { x: sig.xCoordinate, y: sig.yCoordinate },
          pdfCoords: { x: pdfX, y: pdfY },
          scales: { width: widthScale, height: heightScale },
          pageSize: { width: pdfWidth, height: pdfHeight }
        });

        // Select font
        const normalizeFontName = (fontName) => {
          if (!fontName) return "Great Vibes";
          return fontName.replace(/['"]/g, "").split(",")[0].trim();
        };

        const fontName = normalizeFontName(sig.font);
        const fontBytes = availableFonts[fontName] || availableFonts["Great Vibes"];
        const embeddedFont = await pdfDoc.embedFont(fontBytes);

        // Draw signature
        const fontSize = 20;
        const ascent = embeddedFont.heightAtSize(fontSize);
        page.drawText(sig.signature, {
          x: pdfX,
          y: pdfY - ascent,
          size: fontSize,
          font: embeddedFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    // Save signed PDF
    const newFilename = `signed-${Date.now()}.pdf`;
    const signedDir = path.join(__dirname, "..", "signed");
    
    // Ensure signed directory exists
    if (!fs.existsSync(signedDir)) {
      fs.mkdirSync(signedDir, { recursive: true });
    }

    const newFilePath = path.join(signedDir, newFilename);
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(newFilePath, pdfBytes);

    // Update signatures and document
    await Signature.updateMany(
      { file: fileId, status: "pending" },
      { $set: { status: "signed", signedAt: new Date() } }
    );

    document.signedFile = `signed/${newFilename}`;
    document.status = "signed";
    await document.save();

    res.json({
      success: true,
      msg: "PDF finalized successfully",
      signedFile: `signed/${newFilename}`,
    });

  } catch (error) {
    console.error("Error in finalization:", error);
    res.status(500).json({ 
      success: false,
      msg: "Failed to finalize PDF",
      error: error.message 
    });
  }
});

router.delete("/clear-signatures", auth, async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ msg: "Missing file ID" });
    }

    // Delete all signatures for the file by the current user
    await Signature.deleteMany({ file: fileId, signer: req.user });

    res.json({ msg: "Signatures cleared successfully" });
  } catch (error) {
    console.error("Error clearing signatures:", error);
    res.status(500).json({ msg: "Failed to clear signatures" });
  }
});

// Remove a specific signature by ID (only by the owner)
router.delete("/remove/:signatureId", auth, async (req, res) => {
  try {
    const { signatureId } = req.params;
    const signature = await Signature.findById(signatureId);

    if (!signature) {
      return res.status(404).json({ msg: "Signature not found" });
    }
    // Only allow the owner to delete
    if (signature.signer.toString() !== req.user) {
      return res
        .status(403)
        .json({ msg: "Not authorized to delete this signature" });
    }

    await Signature.deleteOne({ _id: signatureId });
    res.json({ msg: "Signature removed successfully" });
  } catch (error) {
    console.error("Error removing signature:", error);
    res.status(500).json({ msg: "Failed to remove signature" });
  }
});

//Audit Route
router.get("/audit/:fileID", auth, async (req, res) => {
  try {
    const fileid = req.params.fileID;

    const audit = await Signature.find({ file: fileid })
      .populate("signer", "name email")
      .select("signer signedAt ipAddress");

    res.json(audit);
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server Error" });
  }
});

// Status Managment reason for accept the signed file
router.post("/accept/:id", auth, async (req, res) => {
  try {
    const signature = await Signature.findById(req.params.id);
    if (!signature) {
      return res.status(404).json({ msg: "Signature not found" });
    }
    signature.status = "signed";
    signature.signedAt = new Date();

    await signature.save();
    // Upadating documents status
    await Document.findByIdAndUpdate(signature.file, { status: "signed" });
    res.json({ msg: "Signature Accepted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Serve error" });
  }
});
// Status Managment Reson for reject the signed file
router.post("/reject/:id", auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const signature = await Signature.findById(req.params.id);
    if (!signature) {
      return res.status(404).json({ msg: "Signature not found" });
    }
    signature.status = "rejected";
    signature.rejectReason = reason;

    await signature.save();
    await Document.findByIdAndUpdate(signature.file, { status: "rejected" });
    res.json({ msg: "Signature rejected" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Server error" });
  }
});
module.exports = router;
