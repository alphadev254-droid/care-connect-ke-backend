const express = require('express');
const router = express.Router();
const caregiverTerms = require('../data/caregiver-terms');
const patientTerms = require('../data/patient-terms');
const PDFDocument = require('pdfkit');

// Get terms and conditions based on user role
router.get('/terms/:role', (req, res) => {
  try {
    const { role } = req.params;
    
    let terms;
    switch (role) {
      case 'caregiver':
        terms = caregiverTerms;
        break;
      case 'patient':
        terms = patientTerms;
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid role specified' 
        });
    }

    res.json({
      success: true,
      data: {
        terms,
        role
      }
    });
  } catch (error) {
    console.error('Error fetching terms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch terms and conditions'
    });
  }
});

// Generate PDF for terms and conditions
router.get('/terms/:role/pdf', (req, res) => {
  try {
    const { role } = req.params;
    
    let terms;
    let title;
    switch (role) {
      case 'caregiver':
        terms = caregiverTerms;
        title = 'Terms of Service and Privacy Policy for Caregivers';
        break;
      case 'patient':
        terms = patientTerms;
        title = 'Terms of Service and Privacy Policy for Patients';
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid role specified' 
        });
    }

    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4'
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${role}-terms-conditions.pdf"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add header
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('CareConnect Home Care System', { align: 'center' })
       .moveDown();

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(title, { align: 'center' })
       .moveDown(2);

    // Process and add content
    const lines = terms.split('\n');
    let currentFontSize = 12;
    
    lines.forEach(line => {
      if (line.trim() === '') {
        doc.moveDown(0.5);
        return;
      }

      // Handle headers
      if (line.startsWith('===')) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(line.replace(/=/g, '').trim(), { align: 'center' })
           .moveDown();
        return;
      }

      // Handle numbered sections
      if (/^\d+\./.test(line.trim())) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(line.trim())
           .moveDown(0.5);
        return;
      }

      // Handle bullet points
      if (line.trim().startsWith('•')) {
        doc.fontSize(11)
           .font('Helvetica')
           .text(line.trim(), { indent: 20 })
           .moveDown(0.3);
        return;
      }

      // Handle regular text
      if (line.trim()) {
        doc.fontSize(11)
           .font('Helvetica')
           .text(line.trim(), { align: 'justify' })
           .moveDown(0.5);
      }
    });

    // Add footer
    doc.fontSize(10)
       .font('Helvetica')
       .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, doc.page.height - 50, {
         align: 'center'
       });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF'
    });
  }
});

module.exports = router;