import PDFDocument from 'pdfkit';
const fmt = (n: number) => `£${n.toFixed(2)}`;
export async function buildStatementPdf(teamName: string, rangeLabel: string, items: { date: string; teamName?: string; userName: string; description: string; settlementNote?: string | null; amount: number }[]) {
  const doc = new PDFDocument({ margin: 42, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  doc.fontSize(20).fillColor('#0f172a').text(`${teamName} - expense report`);
  doc.fontSize(10).fillColor('#64748b').text(rangeLabel);
  doc.moveDown(1.2);
  const cols = teamName === 'All teams'
    ? { date: 42, team: 105, name: 190, desc: 275, amount: 485 }
    : { date: 42, name: 120, desc: 260, amount: 485 };
  const descWidth = teamName === 'All teams' ? 195 : 195;
  const drawHeader = () => {
    doc.fontSize(9).fillColor('#64748b');
    doc.text('Date', cols.date, doc.y);
    if (teamName === 'All teams') doc.text('Team', cols.team, doc.y - doc.currentLineHeight());
    doc.text('Employee', cols.name, doc.y - doc.currentLineHeight());
    doc.text('Description', cols.desc, doc.y - doc.currentLineHeight());
    doc.text('Amount', cols.amount, doc.y - doc.currentLineHeight());
    doc.moveDown(.5); doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#e2e8f0').stroke(); doc.moveDown(.5); doc.fillColor('#0f172a');
  };
  drawHeader();
  let total = 0;
  for (const it of items) {
    total += it.amount;
    doc.fontSize(9);
    // Measure how tall this row needs to be before drawing anything, since
    // a settlement note can push the description onto 2-3 lines - without
    // this, rows with wrapped text would visually overlap the row below.
    const descText = it.settlementNote ? `${it.description}\n${it.settlementNote}` : it.description;
    const rowHeight = Math.max(
      doc.heightOfString(descText, { width: descWidth }),
      doc.heightOfString(it.userName, { width: 78 }),
      doc.currentLineHeight(),
    );
    if (doc.y + rowHeight > 760) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    doc.text(it.date, cols.date, y, { width: 58 });
    if (teamName === 'All teams') doc.text(it.teamName || '', cols.team, y, { width: 78 });
    doc.text(it.userName, cols.name, y, { width: 78 });
    doc.fillColor('#0f172a').text(it.description, cols.desc, y, { width: descWidth });
    if (it.settlementNote) doc.fontSize(7.5).fillColor('#b45309').text(it.settlementNote, cols.desc, doc.y, { width: descWidth }).fontSize(9).fillColor('#0f172a');
    doc.text(fmt(it.amount), cols.amount, y, { width: 68, align: 'right' });
    doc.y = y + rowHeight + 8;
  }
  doc.moveDown(.4); doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#e2e8f0').stroke(); doc.moveDown(.5);
  doc.fontSize(11).fillColor('#0f172a').text('Total', cols.desc, doc.y, { width: 195 });
  doc.text(fmt(total), cols.amount, doc.y - doc.currentLineHeight(), { width: 68, align: 'right' });
  doc.end();
  return new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
}
