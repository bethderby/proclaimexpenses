import crypto from 'crypto';

function key(){
  const raw=process.env.BANK_DETAILS_ENCRYPTION_KEY||'';
  if(!/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error('BANK_DETAILS_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters.');
  return Buffer.from(raw,'hex');
}

export function encryptBankDetail(value:string){
  const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);const tag=cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptBankDetail(value:string|null|undefined){
  if(!value)return '';
  try{const [ivRaw,tagRaw,dataRaw]=value.split('.');if(!ivRaw||!tagRaw||!dataRaw)return '';const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(ivRaw,'base64'));decipher.setAuthTag(Buffer.from(tagRaw,'base64'));return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64')),decipher.final()]).toString('utf8');}catch{return '';}
}

export function generateBankEncryptionKey(){return crypto.randomBytes(32).toString('hex');}
