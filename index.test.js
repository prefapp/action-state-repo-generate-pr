const wait = require('./wait');
const autoMergeFromYaml = require('./autoMergeFromYaml');
const ghUtils = require('./ghUtils');
const process = require('process');
const cp = require('child_process');
const path = require('path');
var fs = require('fs');
/*
test('throws invalid number', async () => {
  await expect(wait('foo')).rejects.toThrow('milliseconds not a number');
});

test('wait 500 ms', async () => {
  const start = new Date();
  await wait(500);
  const end = new Date();
  var delta = Math.abs(end - start);
  expect(delta).toBeGreaterThanOrEqual(500);
});
*/

// shows how the runner will run a javascript action with env / stdout protocol
/*
test('test runs', () => {
  process.env['INPUT_MILLISECONDS'] = 500;
  const ip = path.join(__dirname, 'index.js');
  console.log(cp.execSync(`node ${ip}`, {env: process.env}).toString());
})
*/


// Test read config yaml autoMergeFromYaml
test('autoMergeFromYaml yaml not found', () => {
  expect(() => {
    autoMergeFromYaml('./foo/bar.yaml', "app1", "des")
  }).toThrow('Error trying to read configFile: ');
});

test('autoMergeFromYaml invalid enviroment', () => {
  expect(() => {
    autoMergeFromYaml('./fixtures/config.yaml', "app2", "dev")
  }).toThrow("Enviroment dev not in [des, pre, pro]");
});

test('autoMergeFromYaml invalid enviroment', () => {
  expect(() => {
    autoMergeFromYaml('./fixtures/config.yaml', "app3", "des")
  }).toThrow("Application not found: app3");
});

test('autoMergeFromYaml correct execution', () => {
  //console.log(fs.readdirSync('./fixtures'));
  const autoMergeDes = autoMergeFromYaml('./fixtures/config.yaml', "app1", "des");
  expect(autoMergeDes).toBe(true);

  const autoMergePre = autoMergeFromYaml('./fixtures/config.yaml', "app2", "pre");
  expect(autoMergePre).toBe(true);

  const autoMergePro = autoMergeFromYaml('./fixtures/config.yaml', "app1", "pro");
  expect(autoMergePro).toBe(false);
});


// Test pr creation
const context = {
  payload: {
    repository: {
      default_branch: "rama_default",
      name: "repo_name",
      owner: {
        login: "login_dueño"
      }
    }
  }
}

let octokit = {
  rest: {
    pulls: {
      create: jest.fn().mockResolvedValue({data: {number: 42}}),
      requestReviewers: jest.fn().mockResolvedValue("reviewers added"),
      merge: jest.fn().mockResolvedValue("merged"),
    }
  }
}



test('ghUtils prCreate constructor', () => {
  let ghClient = new ghUtils(context, "octokit");
  expect(ghClient.octokit).toBe("octokit");
  expect(ghClient.context).toMatchObject(context);
  expect(ghClient.repoDefaultBranch).toBe("rama_default");
  expect(ghClient.repoName).toBe("repo_name");
  expect(ghClient.repoOwner).toBe("login_dueño");

});


test('ghUtils prCreate', async () => {
  let ghClient = new ghUtils(context, octokit);
  const prNumber = await ghClient.createPr("feature/new-image", "pr title");
  expect(prNumber).toBe(42);
  expect(octokit.rest.pulls.create).toHaveBeenCalledWith(
    expect.objectContaining({
                              owner: "login_dueño",
                              repo: "repo_name",
                              base: "rama_default",
                              head: "feature/new-image",
                              title: "pr title"
                            })
  ,);
});

test('ghUtils prAddReviewers', async () => {
  let ghClient = new ghUtils(context, octokit);
  const ghResponse = await ghClient.prAddReviewers(314, ["rev1", "rev2"]);
  expect(ghResponse).toBe("reviewers added");
  expect(octokit.rest.pulls.requestReviewers).toHaveBeenCalledWith(
    expect.objectContaining({
                              owner: "login_dueño",
                              repo: "repo_name",
                              pull_number: 314,
                              reviewers: ["rev1", "rev2"]
                            })
  ,);
});

test('ghUtils mergePr', async () => {
  let ghClient = new ghUtils(context, octokit);
  const ghResponse = await ghClient.mergePr(666);
  expect(ghResponse).toBe("merged");
  expect(octokit.rest.pulls.merge).toHaveBeenCalledWith(
    expect.objectContaining({
                              owner: "login_dueño",
                              repo: "repo_name",
                              pull_number: 666,
                            })
  ,);
});



