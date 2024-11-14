const { exec, execSync } = require('child_process')
const CI_COMMIT_REF_NAME = process.env.CI_COMMIT_REF_NAME
const CI_COMMIT_MESSAGE = process.env.CI_COMMIT_MESSAGE
const isCI = process.env.CI

const branch = !isCI && execSync('git symbolic-ref --short -q HEAD').toString().trim()

// 正式版本
const isMaster = CI_COMMIT_REF_NAME === 'master' || branch

// CI测试版本
const isCIDev = isCI && !isMaster && CI_COMMIT_MESSAGE?.indexOf('prerelease') >= 0


if (!isCI && !process.argv[2]) {
  console.log(new Error('请提供测试包类型 alpha | beta'))
  process.exit(1)
}

// 本地测试版本
const isLocalDev = !isCI && process.argv[2]

function handlePublish (err, stdout) {
  console.log(stdout)
  const versionsIndex = stdout.indexOf('published successfully:')
  const endIndex = stdout.indexOf('🦋  Creating git tag')
  const result = 
    stdout.slice(versionsIndex, endIndex)
    .replace('published successfully', 'The following packages were successfully published')
    .replaceAll('🦋', '')
    .trim()
  const publishResult = result.replace(/\n/g,'\\n')

  if (!isLocalDev) {
    // 本地是否提交由用户决定，成功后执行 pnpm install 更新 lock 文件
    execSync('pnpm install && git add . && git commit -m "chore(): publish packages"')
    execSync(`git push origin ${CI_COMMIT_REF_NAME}`)
  }

  if (!isMaster) {
    execSync('pnpm cs pre exit')
  }
}

async function runCommands (branchName) {
  if (isCIDev || isLocalDev) {
    try {
      // 尝试 pre 模式，若失败了说明不在 pre 模式，若成功则在 finally 中重新进入
      execSync('pnpm cs pre exit')
    } 
    catch (error) {} 
    finally {
      execSync(`pnpm cs pre enter ${ isLocalDev || 'beta' }`)
    }
  }
  exec('pnpm cs version', (err, stdout) => {
    if (err) {
      console.log(err)
      process.exit(1)
    }
    console.log(stdout)

    // 如果不是使用 wrokspace 协议，则无法执行 pnpm install 去更新 lock 文件，会提示 No matching version found for @A/B，因为 package.json 中的版本已经更新了，但包还未发布
    // 因此 install 需要放到 publish 之后执行
    // 但rollup构建的结果里是没有 @A/B 的最新代码的，因此还是有问题

    // 但用 workspace 协议可以解决问题
    execSync('pnpm --filter "@frorz/*" build')
    
    exec('pnpm cs publish', handlePublish)
  })
}
runCommands()