import { TransactionEntry } from "../mockData/interfaces";

export async function onNewTransaction(transaction: TransactionEntry) {
  console.log('!', transaction, '!');
}
