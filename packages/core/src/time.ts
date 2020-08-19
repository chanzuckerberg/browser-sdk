// (Education) The Summit Learning Platform's demo site freezes time so users can experience
// the platform within a specific time frame. This is important because elements of the platform
// correspond to parts of the school year. We don't want this to impact how we send RUM events to Datadog.
// For everything else, use the standard Date object. 
export function getDate(): Date {
  return ((<any>window).OrigDate && new Date(Date.parse((<any>window).OrigDate()))) || new Date();
}
