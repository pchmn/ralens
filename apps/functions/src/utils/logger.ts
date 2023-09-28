/* eslint-disable @typescript-eslint/no-explicit-any */
function formatMessage(message?: any) {
  return `${process.env.APP_ENV === 'local' ? '\n' : ''}\n${message}\n`;
}

function info(message?: any, ...args: any[]) {
  console.log(formatMessage(message), args);
}

function warn(message?: any, ...args: any[]) {
  console.warn(formatMessage(message), args);
}

function error(message?: any, ...args: any[]) {
  console.error(formatMessage(message), args);
}

export const logger = {
  info,
  warn,
  error,
};
