interface Env {
  REALTIME: Fetcher
}

export const onRequest: PagesFunction<Env> = async (context) => {
  return context.env.REALTIME.fetch(context.request)
}