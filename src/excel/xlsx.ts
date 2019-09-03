import * as fs from 'fs';
import xlsx from 'node-xlsx';

export function parse() {
  console.log("Excel start")
  const header = [
    'Столбец 1',
    'Столбец 2',
    'Столбец 3',
  ];
  const rowsInsert = [
    header,
    [
      'Данные',
    ],
    [
      '1',
      'ещё данные',
      '3',
    ],
  ];
  const options = {
    '!cols':
      [
        { wch: 30 }, // ширина столбцов
        { wch: 10 },
        { wch: 20 },
      ],
  };

  const buffer = xlsx.build([{ name: 'лист 1', data: rowsInsert }], options);
  fs.writeFileSync('./result.xlsx', buffer);
}
