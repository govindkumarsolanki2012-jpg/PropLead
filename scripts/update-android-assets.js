import fs from 'fs';
import path from 'path';

const logoBuffer = fs.readFileSync('public/logo.png');

const targetDirs = [
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
];

targetDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), logoBuffer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), logoBuffer);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), logoBuffer);
  }
});

const splashDirs = [
  'android/app/src/main/res/drawable',
  'android/app/src/main/res/drawable-hdpi',
  'android/app/src/main/res/drawable-xhdpi',
  'android/app/src/main/res/drawable-xxhdpi',
  'android/app/src/main/res/drawable-xxxhdpi',
  'android/app/src/main/res/drawable-port-hdpi',
  'android/app/src/main/res/drawable-port-xhdpi',
  'android/app/src/main/res/drawable-port-xxhdpi',
  'android/app/src/main/res/drawable-port-xxxhdpi',
  'android/app/src/main/res/drawable-land-hdpi',
  'android/app/src/main/res/drawable-land-xhdpi',
  'android/app/src/main/res/drawable-land-xxhdpi',
  'android/app/src/main/res/drawable-land-xxxhdpi',
];

splashDirs.forEach((dir) => {
  if (fs.existsSync(dir)) {
    fs.writeFileSync(path.join(dir, 'splash.png'), logoBuffer);
    fs.writeFileSync(path.join(dir, 'splash_icon_static.png'), logoBuffer);
  }
});

console.log('Android native assets updated successfully!');
