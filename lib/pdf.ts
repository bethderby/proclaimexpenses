import PDFDocument from 'pdfkit';
const fmt = (n: number) => `£${n.toFixed(2)}`;
export async function buildStatementPdf(teamName: string, rangeLabel: string, items: { date: string; teamName?: string; userName: string; description: string; amount: number }[]) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  doc.fontSize(20).fillColor('#0f172a').text(`${teamName} — expense report`);
  doc.fontSize(10).fillColor('#64748b').text(rangeLabel);
  doc.moveDown(1.2);
  const cols = teamName === 'All teams'
    ? { date: 42, team: 105, name: 190, desc: 275, amount: 485 }
    : { date: 42, name: 120, desc: 260, amount: 485 };
  doc.fontSize(9).fillColor('#64748b');
  doc.text('Date', cols.date, doc.y);
  if (teamName === 'All teams') doc.text('Team', cols.team, doc.y - doc.currentLineHeight());
  doc.text('Employee', cols.name, doc.y - doc.currentLineHeight());
  doc.text('Description', cols.desc, doc.y - doc.currentLineHeight());
  doc.text('Amount', cols.amount, doc.y - doc.currentLineHeight());
  doc.moveDown(.5); doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#e2e8f0').stroke(); doc.moveDown(.5); doc.fillColor('#0f172a');
  let total = 0;
  for (const it of items) {
    total += it.amount; const y = doc.y; doc.fontSize(9);
    doc.text(it.date, cols.date, y, { width: 58 });
    if (teamName === 'All teams') doc.text(it.teamName || '', cols.team, y, { width: 78 });
    doc.text(it.userName, cols.name, y, { width: 78 });
    doc.text(it.description, cols.desc, y, { width: 195 });
    doc.text(fmt(it.amount), cols.amount, y, { width: 68, align: 'right' });
    doc.moveDown(.65);
    if (doc.y > 760) { doc.addPage(); }
  }
  doc.moveDown(.4); doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#e2e8f0').stroke(); doc.moveDown(.5);
  doc.fontSize(11).fillColor('#0f172a').text('Total', cols.desc, doc.y, { width: 195 });
  doc.text(fmt(total), cols.amount, doc.y - doc.currentLineHeight(), { width: 68, align: 'right' });
  doc.end();
  return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
}
