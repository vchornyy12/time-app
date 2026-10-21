// @vitest-environment node
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const mocks=vi.hoisted(()=>({getUser:vi.fn(),getSession:vi.fn(),setSession:vi.fn(),signOut:vi.fn(),cookies:null as unknown as {setAll:(c:unknown[])=>void}}))
vi.mock('@supabase/ssr',()=>({createServerClient:(_url:unknown,_key:unknown,options:{cookies:typeof mocks.cookies})=>{
  mocks.cookies=options.cookies
  return {auth:{getUser:mocks.getUser,getSession:mocks.getSession,setSession:mocks.setSession,signOut:mocks.signOut}}
}}))
import {updateSession} from './middleware'
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'verified-owner'}}})
  mocks.getSession.mockResolvedValue({data:{session:{access_token:'access',refresh_token:'refresh'}},error:null})
  mocks.setSession.mockImplementation(async()=>{
    mocks.cookies.setAll([{name:'session',value:'clean',options:{path:'/'}}])
    return {error:null}
  })
  mocks.signOut.mockImplementation(async()=>{mocks.cookies.setAll([{name:'session',value:'',options:{path:'/',maxAge:0}}]);return {error:null}})
})
describe('existing session credential hygiene',()=>{
  it('removes provider credentials from a verified old session without returning them to the browser',async()=>{
    mocks.getSession.mockResolvedValue({data:{session:{access_token:'access',refresh_token:'refresh',provider_token:'synthetic-provider',provider_refresh_token:'synthetic-refresh'}},error:null})
    const response=await updateSession(new NextRequest('https://app.test/inbox'))
    expect(mocks.setSession).toHaveBeenCalledWith({access_token:'access',refresh_token:'refresh'})
    expect(response.cookies.get('session')?.value).toBe('clean')
  })
  it('retains cookie cleanup on an unauthenticated redirect and drops query credentials',async()=>{
    mocks.getUser.mockImplementation(async()=>{mocks.cookies.setAll([{name:'session',value:'',options:{path:'/',maxAge:0}}]);return {data:{user:null}}})
    const response=await updateSession(new NextRequest('https://app.test/inbox?code=sensitive'))
    expect(response.headers.get('location')).toBe('https://app.test/login')
    expect(response.cookies.get('session')?.value).toBe('')
    expect(mocks.getSession).not.toHaveBeenCalled()
  })
  it('does not rewrite a clean session and clears cookies if sanitization fails',async()=>{
    await updateSession(new NextRequest('https://app.test/inbox'))
    expect(mocks.setSession).not.toHaveBeenCalled()
    mocks.getSession.mockResolvedValue({data:{session:null},error:new Error('unavailable')})
    const response=await updateSession(new NextRequest('https://app.test/inbox'))
    expect(mocks.signOut).toHaveBeenCalledWith({scope:'local'})
    expect(response.headers.get('location')).toBe('https://app.test/login')
    expect(response.cookies.get('session')?.value).toBe('')
  })
})
