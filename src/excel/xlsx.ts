import * as fs from 'fs';
import xlsx from 'node-xlsx';
import { Transaction } from "../database/models";
import { UserTransactions } from "../mockData/interfaces";

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

export function parseTransactionsToExcel(transactions: UserTransactions) {
  console.log("Making excel file with transactions...")
  const header = [
    'time',
    'from',
    'to',
    'price',
    'transfer_energy',
    'transfer_coin',
  ];

  let rowsInsert = [
    header,
  ];
  transactions.transaction.forEach(value => {
    rowsInsert.push([`${value.time}`, `${value.from}`, `${value.to}`, `${value.price}`, `${value.transfer_energy}`, `${value.transfer_coin}`])
  })
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
  console.log('Excel done')
}
