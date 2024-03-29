
class QueryParser {
    constructor(global)
    {
        this._global = global;
    }
    static exeVerse(type, queryTokens, verse) {
        if(type === TYPE_COLUMN) {
            queryTokens.columns.push(verse);
        }
        if(type === TYPE_FROM) {
            queryTokens.froms.push(verse);
        }
        if(type === TYPE_WHERE) {
            if(/^and$/i.test(verse)) {
                verse = verse.toUpperCase();
            }
            queryTokens.wheres.push(verse);
        }
        if(type === TYPE_VALUES) {
            queryTokens.values.push(verse);
        }
        if(type === TYPE_ORDERS) {
            queryTokens.orders.push(verse);
        }
        console.log(verse);
    }

    static makeSyntaxTree(queryType, queryTokens)
    {
        let root = new Node();
        switch (queryType) {
            case "select":
                root.type = NODE_TYPE_SELECT;
                break;
            case "update":
                root.type = NODE_TYPE_UPDATE;
                break;
            case "insert":
                root.type = NODE_TYPE_INSERT;
                break;
            case "delete":
                root.type = NODE_TYPE_DELETE;
                break;
            default:
                throw Error("error");
        }

        if(root.type === NODE_TYPE_SELECT || root.type === NODE_TYPE_INSERT){
            let columnNode = new Node(NODE_CHILD_TYPE_COLUMN);

            if(root.type === NODE_TYPE_INSERT) {
                let into = queryTokens.columns[0].toLowerCase();
                if(into !== "into") {
                    throw Error('INSERT "INTO" error');
                }

                let node = new Node(NODE_CHILD_TYPE_INTO, queryTokens.columns[1]);
                root.addChild(node);
            }

            for(let i = 2;i < queryTokens.columns.length;i++) {
                let column = queryTokens.columns[i];
                if(column !== "," && column !== "("  && column !== ")") {
                    let node = new Node(NODE_VALUE, column);
                    columnNode.addChild(node);
                }
            }
            root.addChild(columnNode);
        }
        if(root.type === NODE_TYPE_SELECT || root.type === NODE_TYPE_UPDATE ||  root.type === NODE_TYPE_DELETE){
            let fromNode = new Node(NODE_CHILD_TYPE_FROM);

            for(let i = 0;i < queryTokens.froms.length;i++) {
                let column = queryTokens.froms[i];
                if(column !== ",") {
                    let node = new Node(NODE_VALUE, column);
                    fromNode.addChild(node);
                }
            }
            root.addChild(fromNode);
        }
        if(root.type === NODE_TYPE_SELECT || root.type === NODE_TYPE_UPDATE ||  root.type === NODE_TYPE_DELETE){
            let whereNode = new Node(NODE_CHILD_TYPE_WHERE);

            let length = queryTokens.wheres.length;
            for(let i = 0;i < length;i++) {
                let column = queryTokens.wheres[i];

                if(column === ",") {
                    continue;
                }
                if(column === "AND") {
                    let node = new Node(NODE_VALUE, "AND");
                    whereNode.addChild(node);
                    continue;
                }
                let formulas = [column];
                for(let j = 0;j < 2;j++) {
                    if((i + 2 <= length) &&  queryTokens.wheres[i + 1] !== "and") {
                        formulas.push(queryTokens.wheres[i + 1]);
                        i++;
                    } else {
                        break;
                    }
                }
                let node = new Node(NODE_VALUE, formulas);
                whereNode.addChild(node);
            }
            root.addChild(whereNode);
        }
        if(root.type === NODE_TYPE_INSERT){
            let valuesNode, nestDepth = 0;

            for(let i = 0;i < queryTokens.values.length;i++) {
                let column = queryTokens.values[i];
                if(column === ";") {
                    break;
                }
                if(column === '(') {
                    valuesNode = new Node(NODE_CHILD_TYPE_VALUES);
                    nestDepth++;
                }
                if(column === ')') {
                    root.addChild(valuesNode);
                    nestDepth--;
                }
                if(/[a-zA-Z0-9_]+/.test(column)) {
                    let next = queryTokens.values[i + 1] !== undefined ? queryTokens.values[i + 1] : null;
                    let next2 = queryTokens.values[i + 2] !== undefined ? queryTokens.values[i + 2] : null;
                    if(next === "(" && next2 === ")") {
                        let node = new Node(NODE_VALUE, column + next + next2);
                        valuesNode.addChild(node);
                        i += 2;
                        continue;
                    }
                }
                // Value type
                if(column !== "," && column !== "("  && column !== ")") {
                    console.log("value", column);
                    if(column.indexOf("\\") >= 0) {
                        column = escapeByCharacter(column);
                    }
                    let node = new Node(NODE_VALUE, column);
                    valuesNode.addChild(node);
                }
            }
            let nameCount = root.children[1].children.length;
            for(let i = 2;i < root.children.length;i++) {
                if(nameCount !== root.children[i].children.length) {
                    throw new Error("length error");
                }
            }
        }
        return root;
    }

    lexicalAnalysis(sql)
    {
        let verseList = [];
        let verse = "", quote = null, inOnelineComment = false;
        for(let i = 0;i < sql.length;i++) {
            const char = sql[i];

            if (inOnelineComment) {
                if (char === '\n') {
                    if (verse !== '') {
                        verseList.push(verse);
                    }
                    verse = "";

                    inOnelineComment = false;
                } else {
                    verse += char
                }
                continue;
            }
            if(quote !== null) {
                if(char === quote) {
                    verse = quote + verse + quote;
                    verseList.push(verse);
                    verse = "";
                    quote = null;
                } else {
                    verse += char;
                }
                continue;
            }
            if (char === '-') {
                const next = sql[i + 1];
                if (next === '-') {
                    if (verse !== '') {
                        verseList.push(verse);
                    }
                    verse = "--";
                    inOnelineComment = true;
                    i += 1;
                    continue;
                }
            }
            if(char === '\'' || char === '"' || char === '`') {
                quote = char;
            } else if(['+', '-', '/', '*'].includes(char)) {
                if(verse !== "") {
                    verseList.push(verse);
                    verse = "";
                }

                verseList.push(char);
            } else if(char === ' ' || char === '\t' || char === '\r' || char === '\n') {
                if(verse !== "") {
                    verseList.push(verse);
                }
                verse = "";
            } else if(char === ',' || char === '(' || char === ')') {
                if(verse !== "") {
                    verseList.push(verse);
                }
                verseList.push(char);
                verse = "";
            } else if(char === ';') {
                if(verse !== "") {
                    verseList.push(verse);
                    verse = "";
                }
                verseList.push(char);
            } else {
                verse += char;
            }
        }
        if(verse !== "") {
            verseList.push(verse);
        }
        return verseList;
    }

    tokernise(sql)
    {
        let queryTokens = {
            columns: [],
            froms: [],
            wheres: [],
            values: [],
            orders: [],
            into: null
        };
        let queryTokensList = [];

        let type = TYPE_NONE, queryType = null;
        let tokens = this.lexicalAnalysis(sql);
        console.log(tokens);
        for (let token of tokens) {
            // console.log(type, token);
            if (token.startsWith("--")) {
                continue;
            }
            if (token === ";") {
                type = TYPE_NONE;
                queryTokensList.push([queryType, queryTokens]);
                queryTokens = {
                    columns: [],
                    froms: [],
                    wheres: [],
                    values: [],
                    orders: [],
                    into: null
                };
            }
            if (type === TYPE_NONE) {
                let verse2 = token.toLowerCase();
                if(verse2 === "select" || verse2 === "insert") {
                    type = TYPE_COLUMN;
                    queryType = verse2;
                }
            } else if (type === TYPE_COLUMN) {
                let verse2 = token.toLowerCase();
                if (verse2 === "from") {
                    type = TYPE_FROM;
                } else if (verse2 === "values") {
                    type = TYPE_VALUES;
                } else {
                    QueryParser.exeVerse(type, queryTokens, token);
                }
            } else if (type === TYPE_FROM) {
                let verse2 = token.toLowerCase();
                if (verse2 === "where") {
                    type = TYPE_WHERE;
                } else {
                    QueryParser.exeVerse(type, queryTokens, token);
                }
            } else if (type === TYPE_VALUES) {
                let verse2 = token.toLowerCase();
                QueryParser.exeVerse(type, queryTokens, token);
            } else if (type === TYPE_WHERE) {
                let verse2 = token.toLowerCase();
                if (verse2 === "order") {
                    type = TYPE_ORDERS;
                } else {
                    QueryParser.exeVerse(type, queryTokens, token);
                }
            } else if (type === TYPE_ORDERS) {
                QueryParser.exeVerse(type, queryTokens, token);
            }
        }
        if (type !== TYPE_NONE) {
            queryTokensList.push([queryType, queryTokens]);
        }
        return queryTokensList;
    }

    convert(sql)
    {
        let queryTokensList = this.tokernise(sql);
        let parseResultList = [];
        for (let [queryType, queryTokens] of queryTokensList) {
            let syntaxTree = QueryParser.makeSyntaxTree(queryType, queryTokens);

            let selectors = [], froms = [], wheres = [], records = [], into = null;
            for(let i = 0;i < syntaxTree.children.length;i++) {
                let node = syntaxTree.children[i];
                if(node.type === NODE_CHILD_TYPE_COLUMN) {
                    for(let child of node.children) {
                        selectors.push(child.value);
                    }
                }
                if(node.type === NODE_CHILD_TYPE_FROM) {
                    for(let child of node.children) {
                        froms.push(child.value);
                    }
                }
                if(node.type === NODE_CHILD_TYPE_WHERE) {
                    for(let child of node.children) {
                        wheres.push(child.value);
                    }
                }
                if(node.type === NODE_CHILD_TYPE_VALUES) {
                    let values = [];
                    for(let child of node.children) {
                        values.push(child.value);
                    }
                    records.push(values);
                }
                if(node.type === NODE_CHILD_TYPE_INTO) {
                    into = node.value;
                }
            }
            let parseResult = {type: queryType};
            if(queryType === "select" || queryType === "update" || queryType === "delete") {
                // let dataSource = fromToDataSource(this._global, froms);
                // dataSource = filterByWhere(dataSource, wheres, selectors);
                // parseResult["dataSource"] = dataSource;
                parseResultList.push(parseResult);
            } else if(queryType === "insert") {
                // parseResult["selectors"] = selectors;
                // parseResult["records"] = records;
                // parseResult["into"] = into;
                parseResultList.push(parseResult);
            }
        }
        return parseResultList;
    }

    convert2(sql)
    {
        let [queryType, queryTokens] = this.tokernise(sql);
        console.log("QueryType=", queryType);
        console.log("queryTokens.columns=", queryTokens.columns);
        console.log("queryTokens.froms=", queryTokens.froms);
        console.log("queryTokens.wheres=", queryTokens.wheres);
        console.log("queryTokens.values=", queryTokens.values);

        let syntaxTree = QueryParser.makeSyntaxTree(queryType, queryTokens);
        console.log("makeSyntaxTree", syntaxTree);

        console.group();
        printSyntaxTree(syntaxTree);
        console.groupEnd();

        let selectors = [], froms = [], wheres = [], records = [], into = null;
        for(let i = 0;i < syntaxTree.children.length;i++) {
            let node = syntaxTree.children[i];
            if(node.type === NODE_CHILD_TYPE_COLUMN) {
                for(let child of node.children) {
                    selectors.push(child.value);
                }
            }
            if(node.type === NODE_CHILD_TYPE_FROM) {
                for(let child of node.children) {
                    froms.push(child.value);
                }
            }
            if(node.type === NODE_CHILD_TYPE_WHERE) {
                for(let child of node.children) {
                    wheres.push(child.value);
                }
            }
            if(node.type === NODE_CHILD_TYPE_VALUES) {
                let values = [];
                for(let child of node.children) {
                    values.push(child.value);
                }
                records.push(values);
            }
            if(node.type === NODE_CHILD_TYPE_INTO) {
                into = node.value;
            }
        }
        let parseResult = {type: queryType};
        if(queryType === "select" || queryType === "update" || queryType === "delete") {
            let dataSource = fromToDataSource(this._global, froms);
            console.log(dataSource);
            dataSource = filterByWhere(dataSource, wheres, selectors);
            parseResult["dataSource"] = dataSource;
            return parseResult;   
        }
        if(queryType === "insert") {
            parseResult["selectors"] = selectors;
            parseResult["records"] = records;
            parseResult["into"] = into;
            return parseResult;
        }
    }
}