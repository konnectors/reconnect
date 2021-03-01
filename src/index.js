const {
  cozyClient,
  BaseKonnector,
  log,
  requestFactory,
  saveFiles
} = require("cozy-konnector-libs");

const request = requestFactory({
  // The debug mode shows all the details about HTTP requests and responses. Very useful for
  // debugging but very verbose. This is why it is commented out by default
  // debug: true,
  // Activates [cheerio](https://cheerio.js.org/) parsing on each page
  cheerio: false,
  // If cheerio is activated do not forget to deactivate json parsing (which is activated by
  // default in cozy-konnector-libs
  json: true,
  // This allows request-promise to keep cookies between requests
  jar: true
});

const BASE_URL = "https://www.dev.reconnect.fr";

async function start(fields, cozyParameters) {
  try {
    const clientId = cozyParameters.secret.clientId;
    const clientSecret = cozyParameters.secret.clientSecret;

    await this.deactivateAutoSuccessfulLogin();
    access_token = await authenticate(
      fields.login,
      fields.password,
      clientId,
      clientSecret
    );
    await this.notifySuccessfulLogin();

    user = await getUser(access_token);
    documents = await getDocuments(user.subject_id, access_token);
    folders = await getFolders(user.subject_id, access_token);
    parsed_documents = await parseDocumentsFromFolders(documents, folders);

    await saveFiles(parsed_documents, fields);
  } catch (error) {
    throw new Error(error.message);
  }
}

async function authenticate(username, password, clientId, clientSecret) {
  const url =
    BASE_URL +
    "/oauth/v2/token?grant_type=password&client_id=" +
    clientId +
    "&client_secret=" +
    clientSecret +
    "&username=" +
    username +
    "&password=" +
    password;
  response = await request(url);
  return response.access_token;
}

async function getUser(access_token) {
  const url = BASE_URL + "/api/user?" + "access_token=" + access_token;
  user = await request(url);
  return user;
}

async function getDocuments(beneficiary_id, access_token) {
  const url =
    BASE_URL +
    "/api/v2/beneficiaries/" +
    beneficiary_id +
    "/documents?access_token=" +
    access_token;
  documents = await request(url);
  return documents;
}

async function getFolders(beneficiary_id, access_token) {
  const url =
    BASE_URL +
    "/api/v2/beneficiaries/" +
    beneficiary_id +
    "/folders?access_token=" +
    access_token;
  folders = await request(url);
  return folders;
}

async function parseDocuments(documents) {
  return documents.map(doc => {
    var parsed_doc = {};
    parsed_doc["filename"] = doc.nom;
    parsed_doc["fileurl"] = doc.url;
    parsed_doc["folder_id"] = doc.folder_id;
    parsed_doc["subPath"] = "";

    return parsed_doc;
  });
}

async function parseDocumentsFromFolders(documents, folders) {
  let parsed_documents = await parseDocuments(documents);

  parsed_documents.forEach(document => {
    let parentFolderId = document.folder_id;
    while (parentFolderId) {
      let parentFolder = folders.find(folder => {
        return folder.id === parentFolderId;
      });
      document.subPath = parentFolder.nom + "/" + document.subPath;
      parentFolderId = parentFolder.dossier_parent_id;
    }
  });
  return parsed_documents;
}

module.exports = new BaseKonnector(start);
