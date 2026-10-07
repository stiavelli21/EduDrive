export namespace models {
	
	export class AIChatMessage {
	    role: string;
	    text: string;
	    selectedText: string;
	    hasImageCrop: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AIChatMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.text = source["text"];
	        this.selectedText = source["selectedText"];
	        this.hasImageCrop = source["hasImageCrop"];
	    }
	}
	export class AIAskRequest {
	    requestId: string;
	    itemId: string;
	    documentName: string;
	    documentText: string;
	    question: string;
	    selectedText: string;
	    imageCropBase64: string;
	    imageCropMime: string;
	    history: AIChatMessage[];
	
	    static createFrom(source: any = {}) {
	        return new AIAskRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.itemId = source["itemId"];
	        this.documentName = source["documentName"];
	        this.documentText = source["documentText"];
	        this.question = source["question"];
	        this.selectedText = source["selectedText"];
	        this.imageCropBase64 = source["imageCropBase64"];
	        this.imageCropMime = source["imageCropMime"];
	        this.history = this.convertValues(source["history"], AIChatMessage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class AIModelInfo {
	    id: string;
	    displayName: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new AIModelInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.displayName = source["displayName"];
	        this.description = source["description"];
	    }
	}
	export class AISettings {
	    hasApiKey: boolean;
	    maskedKey: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new AISettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hasApiKey = source["hasApiKey"];
	        this.maskedKey = source["maskedKey"];
	        this.model = source["model"];
	    }
	}
	export class Breadcrumb {
	    id: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Breadcrumb(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	    }
	}
	export class ExamDate {
	    id: string;
	    subject: string;
	    // Go type: time
	    examDate: any;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new ExamDate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.subject = source["subject"];
	        this.examDate = this.convertValues(source["examDate"], null);
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Item {
	    id: string;
	    name: string;
	    parentId?: string;
	    isFolder: boolean;
	    sizeBytes: number;
	    mimeType: string;
	    storagePath: string;
	    isTrash: boolean;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new Item(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.parentId = source["parentId"];
	        this.isFolder = source["isFolder"];
	        this.sizeBytes = source["sizeBytes"];
	        this.mimeType = source["mimeType"];
	        this.storagePath = source["storagePath"];
	        this.isTrash = source["isTrash"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PassedExam {
	    id: string;
	    subject: string;
	    grade: number;
	    isHonors: boolean;
	    cfu: number;
	    examDate: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new PassedExam(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.subject = source["subject"];
	        this.grade = source["grade"];
	        this.isHonors = source["isHonors"];
	        this.cfu = source["cfu"];
	        this.examDate = source["examDate"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PodcastTurn {
	    speaker: string;
	    text: string;
	    startTime: number;
	    endTime: number;
	
	    static createFrom(source: any = {}) {
	        return new PodcastTurn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.speaker = source["speaker"];
	        this.text = source["text"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	    }
	}
	export class PodcastEpisode {
	    id: string;
	    title: string;
	    topic: string;
	    tone: string;
	    sourceItemIds: string[];
	    sourceItemNames: string[];
	    turns: PodcastTurn[];
	    audioPath: string;
	    durationSeconds: number;
	    // Go type: time
	    createdAt: any;
	
	    static createFrom(source: any = {}) {
	        return new PodcastEpisode(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.topic = source["topic"];
	        this.tone = source["tone"];
	        this.sourceItemIds = source["sourceItemIds"];
	        this.sourceItemNames = source["sourceItemNames"];
	        this.turns = this.convertValues(source["turns"], PodcastTurn);
	        this.audioPath = source["audioPath"];
	        this.durationSeconds = source["durationSeconds"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PodcastGenerateRequest {
	    itemIds: string[];
	    customQuestions: string;
	    tone: string;
	    length: string;
	
	    static createFrom(source: any = {}) {
	        return new PodcastGenerateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemIds = source["itemIds"];
	        this.customQuestions = source["customQuestions"];
	        this.tone = source["tone"];
	        this.length = source["length"];
	    }
	}
	
	export class StorageStats {
	    totalSizeBytes: number;
	    totalFiles: number;
	    totalFolders: number;
	    trashSizeBytes: number;
	    trashItems: number;
	
	    static createFrom(source: any = {}) {
	        return new StorageStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalSizeBytes = source["totalSizeBytes"];
	        this.totalFiles = source["totalFiles"];
	        this.totalFolders = source["totalFolders"];
	        this.trashSizeBytes = source["trashSizeBytes"];
	        this.trashItems = source["trashItems"];
	    }
	}
	export class StudyHandout {
	    id: string;
	    title: string;
	    topic: string;
	    mode: string;
	    detailLevel: string;
	    sourceItemIds: string[];
	    sourceItemNames: string[];
	    contentMarkdown: string;
	    driveItemId?: string;
	    // Go type: time
	    createdAt: any;
	    // Go type: time
	    updatedAt: any;
	
	    static createFrom(source: any = {}) {
	        return new StudyHandout(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.topic = source["topic"];
	        this.mode = source["mode"];
	        this.detailLevel = source["detailLevel"];
	        this.sourceItemIds = source["sourceItemIds"];
	        this.sourceItemNames = source["sourceItemNames"];
	        this.contentMarkdown = source["contentMarkdown"];
	        this.driveItemId = source["driveItemId"];
	        this.createdAt = this.convertValues(source["createdAt"], null);
	        this.updatedAt = this.convertValues(source["updatedAt"], null);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class StudyHandoutGenerateRequest {
	    title: string;
	    topic: string;
	    itemIds: string[];
	    mode: string;
	    detailLevel: string;
	    customInstructions: string;
	    saveToDrive: boolean;
	    targetFolderId: string;
	
	    static createFrom(source: any = {}) {
	        return new StudyHandoutGenerateRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.title = source["title"];
	        this.topic = source["topic"];
	        this.itemIds = source["itemIds"];
	        this.mode = source["mode"];
	        this.detailLevel = source["detailLevel"];
	        this.customInstructions = source["customInstructions"];
	        this.saveToDrive = source["saveToDrive"];
	        this.targetFolderId = source["targetFolderId"];
	    }
	}

}

