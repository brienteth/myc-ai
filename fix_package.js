const fs = require('fs');

const packagePath = '/Users/bl10buer/Desktop/myca/desktop/package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

pkg.build.extraResources = [
  {
    "from": "backend-dist",
    "to": "backend"
  }
];

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
console.log("Updated package.json");
