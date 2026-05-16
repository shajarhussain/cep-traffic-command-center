const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');

(async () => {
  try {
    const pdf = await mdToPdf({ path: 'docs/FINAL_REPORT.md' }, {
      dest: 'artifacts/Event-Driven-Traffic-Alert-System-Final-Report.pdf',
      basedir: 'docs',
      pdf_options: { format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' } }
    });

    if (pdf) {
      console.log('PDF created successfully at artifacts/Event-Driven-Traffic-Alert-System-Final-Report.pdf');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    process.exit(1);
  }
})();
