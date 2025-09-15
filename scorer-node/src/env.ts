import dotenv from "dotenv";
// force .env to override any existing env variables
dotenv.config({ override: true });


const required=(k:string)=>{
  const v=process.env[k];
  if(!v) throw new Error(`Missing env ${k}`);
  return v;
};

export const ENV={
  PORT: Number(process.env.PORT||8080),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "set-me-later",
  CORS_ORIGINS: (process.env.CORS_ORIGINS||"*").split(",").map(s=>s.trim()),
  RATE_LIMIT_PER_MIN: Number(process.env.RATE_LIMIT_PER_MIN||30)
};
