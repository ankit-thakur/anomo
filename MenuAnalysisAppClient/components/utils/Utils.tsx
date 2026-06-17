export const formatDisplayList = (items: string[]): string => {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  
  const allButLast = items.slice(0, -1).join(", ");
  const last = items[items.length - 1];
  return `${allButLast}, and ${last}`;
};

