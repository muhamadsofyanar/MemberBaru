import {handle} from "@/lib/api";import {softwareAction} from "@/lib/software-license";
export async function POST(req:Request){return handle(async()=>softwareAction("update",await req.json()));}
