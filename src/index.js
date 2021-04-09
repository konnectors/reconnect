process.env.SENTRY_DSN =
  process.env.SENTRY_DSN ||
  'https://1b0c32c864e543fd9dc10585dfd09ff2@sentry.cozycloud.cc/148'

const {
  BaseKonnector,
  requestFactory,
  saveFiles,
  errors
} = require('cozy-konnector-libs')

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
})

async function start(fields, cozyParameters) {
  try {
    const baseURL = cozyParameters.secret.reconnectBaseURL
    const clientId = cozyParameters.secret.clientId
    const clientSecret = cozyParameters.secret.clientSecret

    await this.deactivateAutoSuccessfulLogin()
    const access_token = await authenticate(
      baseURL,
      fields.login,
      fields.password,
      clientId,
      clientSecret
    )
    await this.notifySuccessfulLogin()

    const user = await getUser(baseURL, access_token)
    const documents = await getDocuments(baseURL, user.subject_id, access_token)
    const folders = await getFolders(baseURL, user.subject_id, access_token)
    const parsed_documents = await parseDocumentsFromFolders(documents, folders)

    await saveFiles(parsed_documents, fields)
  } catch (error) {
    throw error
  }
}

async function authenticate(
  baseURL,
  username,
  password,
  clientId,
  clientSecret
) {
  const url =
    baseURL +
    '/oauth/v2/token?grant_type=password&client_id=' +
    clientId +
    '&client_secret=' +
    clientSecret +
    '&username=' +
    username +
    '&password=' +
    password
  try {
    const response = await request(url)
    return response.access_token
  } catch (error) {
    throw new Error(errors.LOGIN_FAILED)
  }
}

async function getUser(baseURL, access_token) {
  const url = baseURL + '/api/user?' + 'access_token=' + access_token

  try {
    const user = await request(url)
    return user
  } catch (error) {
    throw new Error(errors.VENDOR_DOWN)
  }
}

async function getDocuments(baseURL, beneficiary_id, access_token) {
  const url =
    baseURL +
    '/api/v2/beneficiaries/' +
    beneficiary_id +
    '/documents?access_token=' +
    access_token

  try {
    const documents = await request(url)
    return documents
  } catch (error) {
    throw new Error(errors.VENDOR_DOWN)
  }
}

async function getFolders(baseURL, beneficiary_id, access_token) {
  const url =
    baseURL +
    '/api/v2/beneficiaries/' +
    beneficiary_id +
    '/folders?access_token=' +
    access_token

  try {
    const folders = await request(url)
    return folders
  } catch (error) {
    throw new Error(errors.VENDOR_DOWN)
  }
}

async function parseDocuments(documents) {
  return documents.map(doc => {
    var parsed_doc = {}
    parsed_doc['filename'] = doc.nom
    parsed_doc['fileurl'] = doc.url
    parsed_doc['folder_id'] = doc.folder_id
    parsed_doc['subPath'] = ''

    return parsed_doc
  })
}

async function parseDocumentsFromFolders(documents, folders) {
  let parsed_documents = await parseDocuments(documents)

  parsed_documents.forEach(document => {
    let parentFolderId = document.folder_id
    while (parentFolderId) {
      let parentFolder = folders.find(folder => {
        return folder.id === parentFolderId
      })
      document.subPath = parentFolder.nom + '/' + document.subPath
      parentFolderId = parentFolder.dossier_parent_id
    }
  })
  return parsed_documents
}

module.exports = new BaseKonnector(start)
