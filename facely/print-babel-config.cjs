const babel = require("@babel/core");

async function main() {
  try {
    const result = babel.loadPartialConfig({ filename: "./index.ts" });
    
    if (!result) {
      console.log("No Babel configuration found");
      process.exit(1);
    }
    
    console.log(JSON.stringify(result.options, null, 2));
    process.exit(0);
  } catch (error) {
    console.error("Error loading Babel config:", error.message);
    process.exit(1);
  }
}

main();