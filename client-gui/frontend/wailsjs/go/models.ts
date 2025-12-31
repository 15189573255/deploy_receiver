export namespace database {
	
	export class HistoryEntry {
	    id: number;
	    serverId: string;
	    serverName: string;
	    pathKey: string;
	    filename: string;
	    fileSize: number;
	    status: string;
	    errorMsg: string;
	    uploadedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HistoryEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.serverId = source["serverId"];
	        this.serverName = source["serverName"];
	        this.pathKey = source["pathKey"];
	        this.filename = source["filename"];
	        this.fileSize = source["fileSize"];
	        this.status = source["status"];
	        this.errorMsg = source["errorMsg"];
	        this.uploadedAt = source["uploadedAt"];
	    }
	}
	export class KeyPair {
	    privateKey: string;
	    publicKey: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new KeyPair(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.privateKey = source["privateKey"];
	        this.publicKey = source["publicKey"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Schedule {
	    id: string;
	    name: string;
	    cronExpr: string;
	    filePath: string;
	    serverId: string;
	    pathKey: string;
	    extract: boolean;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Schedule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.cronExpr = source["cronExpr"];
	        this.filePath = source["filePath"];
	        this.serverId = source["serverId"];
	        this.pathKey = source["pathKey"];
	        this.extract = source["extract"];
	        this.enabled = source["enabled"];
	    }
	}
	export class Server {
	    id: string;
	    name: string;
	    url: string;
	    paths: string[];
	    isDefault: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.paths = source["paths"];
	        this.isDefault = source["isDefault"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class WatchConfig {
	    id: string;
	    folderPath: string;
	    serverId: string;
	    pathKey: string;
	    patterns: string[];
	    debounceMs: number;
	    enabled: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WatchConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.folderPath = source["folderPath"];
	        this.serverId = source["serverId"];
	        this.pathKey = source["pathKey"];
	        this.patterns = source["patterns"];
	        this.debounceMs = source["debounceMs"];
	        this.enabled = source["enabled"];
	    }
	}

}

export namespace main {
	
	export class UploadResultWrapper {
	    success: boolean;
	    status: string;
	    path: string;
	    size: number;
	    pathKey: string;
	    filename: string;
	    extracted: boolean;
	    extractDir: string;
	    error: string;
	    serverName: string;
	
	    static createFrom(source: any = {}) {
	        return new UploadResultWrapper(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.status = source["status"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.pathKey = source["pathKey"];
	        this.filename = source["filename"];
	        this.extracted = source["extracted"];
	        this.extractDir = source["extractDir"];
	        this.error = source["error"];
	        this.serverName = source["serverName"];
	    }
	}

}

