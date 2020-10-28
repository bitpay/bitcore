export const toUint8Array = (str: string): Uint8Array => {
  return new Uint8Array(str.split('').map(letter => letter.charCodeAt(0)));
};

export const base64ToHex = (str: string): string => {
  const bin = window.atob(str);
  const arr = toUint8Array(bin);
  const hexArray = [];
  for (let i = 0; i < arr.length; i++) {
    hexArray.push(arr[i].toString(16).padStart(2, '0'));
  }
  return hexArray.join('');
};

export const toBase64 = (input, encoding: BufferEncoding = 'utf8'): string => {
  const base64 = Buffer.from(input, encoding).toString('base64');
  return encodeBase64(base64);
};

export const encodeBase64 = (base64: string) => {
  return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
};

export const decodeBase64 = (base64: string) => {
  return base64.replace(/-/g, '+').replace(/_/g, '/');
};

// export const hexToBase64 = (str: string): string => {
  
// };