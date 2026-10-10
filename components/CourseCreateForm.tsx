"use client";
import {CourseEditor,type EditableCourse,type PlanOption} from "./CourseEditor";
export function CourseCreateForm({plans=[]}:{plans?:PlanOption[]}){const blank:EditableCourse={title:"",description:"",thumbnail:"",isPublished:false,planIds:[],modules:[]};return <CourseEditor initial={blank} plans={plans}/>}
