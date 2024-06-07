const yamlUtils = require('../utils/YamlUtils.js');
const basePath = "";

test('determineAutoMerge file not found', () => {
  expect(() => {
    yamlUtils.determineAutoMerge('fixtures/tenant1', "release1", "des")
  }).toThrow('Enviroment des not found for application release1 for tenant fixtures/tenant1');
});

test('determineAutoMerge correct execution', () => {
  //console.log(fs.readdirSync('./fixtures'));
  const autoMergeDes = yamlUtils.determineAutoMerge('fixtures/tenant1', "release1", "pre");
  expect(autoMergeDes).toBe(true);

  const autoMergePre = yamlUtils.determineAutoMerge('fixtures/tenant2', "releaseA", "dev");
  expect(autoMergePre).toBe(true);

  const autoMergePro = yamlUtils.determineAutoMerge('fixtures/tenant1', "release2", "pro");
  expect(autoMergePro).toBe(false);

  const autoMergeDev = yamlUtils.determineAutoMerge('fixtures/tenant2', "releaseB", "pre");
  expect(autoMergeDev).toBe(false);
});


test('loadYaml correct execution', () => {
  const images11dev = yamlUtils.loadYaml('./fixtures/tenant1/release1/dev/images.yaml');
  expect(images11dev["proxy"]["image"]).toBe("foo/proxy:dev");
});

test('loadYaml failure', () => {
  expect(() => {
    yamlUtils.loadYaml('./fixtures/tenant2/releaseC/images.yaml')
  }).toThrow('Error trying to read yaml file: ./fixtures/tenant2/releaseC/images.yaml');
});


test('modifyImage correct execution', () => {
  // you need 2 changes of each to make sure it changes
  yamlUtils.modifyImage(basePath, "fixtures/tenant1", "release1", "dev", "proxy", "foo/proxy:bar");
  const modImages11dev = yamlUtils.loadYaml('./fixtures/tenant1/release1/dev/images.yaml');
  expect(modImages11dev["proxy"]["image"]).toBe("foo/proxy:bar");

  const oldValue1 = yamlUtils.modifyImage(basePath, "fixtures/tenant1", "release1", "dev", "proxy", "foo/proxy:dev");
  expect(oldValue1).toBe("foo/proxy:bar");

  const images11devRestored = yamlUtils.loadYaml('./fixtures/tenant1/release1/dev/images.yaml');
  expect(images11devRestored["proxy"]["image"]).toBe("foo/proxy:dev");

  yamlUtils.modifyImage(basePath, "fixtures/tenant2", "releaseB", "pro", "app-server", "foo/common:pro");
  const modimages2Bpro = yamlUtils.loadYaml('./fixtures/tenant2/releaseB/pro/images.yaml');
  expect(modimages2Bpro["app-server"]["image"]).toBe("foo/common:pro");

  const oldValue2 = yamlUtils.modifyImage(basePath, "fixtures/tenant2", "releaseB", "pro", "app-server", "foo/common:bar" );
  expect(oldValue2).toBe("foo/common:pro");
  const images2BproRestore = yamlUtils.loadYaml('./fixtures/tenant2/releaseB/pro/images.yaml');
  expect(images2BproRestore["app-server"]["image"]).toBe("foo/common:bar");

});


test('modifyImage failure', () => {
  expect(() => {
    yamlUtils.modifyImage(basePath, "fixtures/tenant2", "releaseB", "production", "app-server", "foo/common:bar");
  }).toThrow("Error trying to read yaml file: ");

  expect(() => {
    yamlUtils.modifyImage(basePath, "fixtures/tenant2", "releaseB", "pro", "inexistent_service", "foo/common:bar");
  }).toThrow("Error: no service inexistent_service found in file ./fixtures/tenant2/releaseB/pro/images.yaml");

  

});
