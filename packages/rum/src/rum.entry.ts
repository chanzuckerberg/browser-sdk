import {
  assign,
  checkCookiesAuthorized,
  checkIsNotLocalFile,
  commonInit,
  Context,
  ContextValue,
  getGlobalObject,
  ErrorMessage,
  isPercentage,
  makeGlobal,
  makeStub,
  monitor,
  startRequestCollection,
  RequestCompleteEvent,
  UserConfiguration,
} from '@datadog/browser-core'

import { buildEnv } from './buildEnv'
import { startDOMMutationCollection } from './domMutationCollection'
import { LifeCycle, LifeCycleEventType } from './lifeCycle'
import { startPerformanceCollection } from './performanceCollection'
import { startRum } from './rum'
import { startRumSession } from './rumSession'
import { startUserActionCollection, UserActionReference } from './userActionCollection'
import { startViewCollection } from './viewCollection'
import { verifyAndRestore } from 'sinon'

import { filterUrl } from './filters'

export interface RumUserConfiguration extends UserConfiguration {
  applicationId: string,
  //default behavior as if true
  collectErrorMessage?: boolean,
  collectErrorStack?: boolean,
  isCollectingError?: boolean
}

export interface InternalContext {
  application_id: string
  session_id: string | undefined
  view: {
    id: string
  }
  user_action?: UserActionReference
}

const STUBBED_RUM = {
  init(userConfiguration: RumUserConfiguration) {
    makeStub('core.init')
  },
  addRumGlobalContext(key: string, value: ContextValue) {
    makeStub('addRumGlobalContext')
  },
  setRumGlobalContext(context: Context) {
    makeStub('setRumGlobalContext')
  },
  addUserAction(name: string, context: Context) {
    makeStub('addUserAction')
  },
  getInternalContext(): InternalContext | undefined {
    makeStub('getInternalContext')
    return undefined
  },
}

export type RumGlobal = typeof STUBBED_RUM

export const datadogRum = makeGlobal(STUBBED_RUM)
let isAlreadyInitialized = false
datadogRum.init = monitor((userConfiguration: RumUserConfiguration) => {
  if (!checkCookiesAuthorized() || !checkIsNotLocalFile() || !canInitRum(userConfiguration)) {
    return
  }
  if (userConfiguration.publicApiKey) {
    userConfiguration.clientToken = userConfiguration.publicApiKey
  }
  const rumUserConfiguration = { isCollectingError: true, ...userConfiguration }
  const lifeCycle = new LifeCycle()

  const { errorObservable, configuration, internalMonitoring } = commonInit(rumUserConfiguration, buildEnv)
  const session = startRumSession(configuration, lifeCycle)
  const globalApi = startRum(rumUserConfiguration.applicationId, lifeCycle, configuration, session, internalMonitoring)

  startViewCollection(location, lifeCycle, session)
  const [requestStartObservable, requestCompleteObservable] = startRequestCollection()
  startPerformanceCollection(lifeCycle, session)
  startDOMMutationCollection(lifeCycle)
  if (configuration.trackInteractions) {
    startUserActionCollection(lifeCycle)
  }

  errorObservable.subscribe((errorMessage) => lifeCycle.notify(LifeCycleEventType.ERROR_COLLECTED, customizeErrorCollection(rumUserConfiguration, errorMessage)))
  requestStartObservable.subscribe((startEvent) => lifeCycle.notify(LifeCycleEventType.REQUEST_STARTED, startEvent))
  requestCompleteObservable.subscribe((request) => lifeCycle.notify(LifeCycleEventType.REQUEST_COMPLETED, filterRequest(request)))

  assign(datadogRum, globalApi)
  isAlreadyInitialized = true
})

function canInitRum(userConfiguration: RumUserConfiguration) {
  if (isAlreadyInitialized) {
    if (!userConfiguration.silentMultipleInit) {
      console.error('DD_RUM is already initialized.')
    }
    return false
  }
  if (!userConfiguration || (!userConfiguration.clientToken && !userConfiguration.publicApiKey)) {
    console.error('Client Token is not configured, we will not send any data.')
    return false
  }
  if (!userConfiguration.applicationId) {
    console.error('Application ID is not configured, no RUM data will be collected.')
    return false
  }
  if (userConfiguration.sampleRate !== undefined && !isPercentage(userConfiguration.sampleRate)) {
    console.error('Sample Rate should be a number between 0 and 100')
    return false
  }
  if (userConfiguration.resourceSampleRate !== undefined && !isPercentage(userConfiguration.resourceSampleRate)) {
    console.error('Resource Sample Rate should be a number between 0 and 100')
    return false
  }
  return true
}

function customizeErrorCollection(userConfiguration: RumUserConfiguration, errorMessage: ErrorMessage): ErrorMessage {
  if (userConfiguration.collectErrorMessage !== undefined && !userConfiguration.collectErrorMessage) {
    errorMessage.message = "";
  }

  if (userConfiguration.collectErrorStack !== undefined && !userConfiguration.collectErrorStack) {
    errorMessage.context.error.stack = undefined;
  }

  return errorMessage
}

/**
 * ID's can show up in URL page & query parameters. This simply removes them altogether. 
 */
function filterRequest(request: RequestCompleteEvent): RequestCompleteEvent {
  request.url = filterUrl(request.url);
  return request;
}

interface BrowserWindow extends Window {
  DD_RUM?: RumGlobal
}

getGlobalObject<BrowserWindow>().DD_RUM = datadogRum
