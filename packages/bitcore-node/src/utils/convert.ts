export const unixToISO = (unixTimestamp): string => {
  return unixToDate(unixTimestamp).toISOString();
};

export const unixToDate = (unixTimestamp): Date => {
  return new Date(Number(unixTimestamp) * 1000);
};