/*
模板样本：
<script type="text/template" id="demo2">
	嵌套的"#{title}"
</script>
<script type="text/template" id="demo1">
	<div>
		语言(#{helper.language})
		<a href="#">
			print
		</a>
		!#{helper.format("demo2", this)}
		switch(status) {
			case "edit":
				<input type="text" value="#{title}"/><input type="button" value="确定"/>
				break;
			case "normal":
				<span>#{title}</span><input type="button" value="编辑"/>
				break;
		}
		<span>!#{html}</span>
	</div>
</script>

生成结果：
function anonymous(_output_, _format_, helper) {
    with(this) {
        _output_.push("\t\t\t<div>\n\t\t\t\t\u8BED\u8A00(");
        _output_.push(_format_("#{0}", [helper.language]));
        _output_.push(")\n\t\t\t\t<a href=\"#\">\n\t\t\t\t\tprint\n\t\t\t\t</a>\n\t\t\t\t");
        _output_.push(_format_("!#{0}", [helper.format("demo2", this)]));
        _output_.push("\n");
        switch (status) {
        case "edit":
            _output_.push("\t\t\t\t\t\t<input type=\"text\" value=\"");
            _output_.push(_format_("#{0}", [typeof title == "undefined" ? "" : title]));
            _output_.push("\"/><input type=\"button\" value=\"\u786E\u5B9A\"/>\n");
            break;
        case "normal":
            _output_.push("\t\t\t\t\t\t<span>");
            _output_.push(_format_("#{0}", [typeof title == "undefined" ? "" : title]));
            _output_.push("</span><input type=\"button\" value=\"\u7F16\u8F91\"/>\n");
            break;
        default:
            ;
        }
        _output_.push("\t\t\t\t<span>");
        _output_.push(_format_("!#{0}", [typeof html == "undefined" ? "" : html]));
        _output_.push("</span>\n\t\t\t</div>");
    }
}

function anonymous(_output_, _format_, helper) {
    with(this) {
        _output_.push("\t\t\t\u5D4C\u5957\u7684\"");
        _output_.push(_format_("#{0}", [typeof title == "undefined" ? "" : title]));
        _output_.push("\"");
    }
}
*/
	
var AceTemplate = AceTemplate || {};

(function(){
	/**
	 * Ace Engine Template
	 * 一套基于HTML和JS语法自由穿插的模板系统
	 * http://code.google.com/p/ace-engine/wiki/AceTemplate
	 * @author 王集鹄(wangjihu，http://weibo.com/zswang) 鲁亚然(luyaran，http://weibo.com/zinkey)
	 * @version 2011-07-02 
 	 * @copyright (c) 2011, Baidu Inc, All rights reserved.
	 */

	/* Debug Start */
	var logger = {
		/**
		 * 打印日志
		 * @param {Object} text 日志文本
		 */
		log: function(text) {
			/*
			var dom = document.getElementById("log");
			if (dom) {
				dom.value += text + "\n";
			}
			*/
			window.console && console.log(text)			
		}
	};
	/* Debug End */
	
	var htmlDecodeDict = { "quot": '"', "lt": "<", "gt": ">", "amp": "&", "nbsp": " " };
	var htmlEncodeDict = { '"': "quot", "<": "lt", ">": "gt", "&": "amp", " ": "nbsp" };
	var lib = {
        /**
         * 通过id获得DOM对象
         * @param {String} id
         */
        g: function(id){
            if (typeof id != "string") 
                return id;
            return document.getElementById(id);
        },
		/**
		 * HTML解码
		 * @param {String} html
		 */
		decodeHTML: function(html) {
			return String(html).replace(/&(quot|lt|gt|amp|nbsp);/ig, function(all, key) {
				return htmlDecodeDict[key];
			}).replace(/&#u([a-f\d]{4});/ig, function(all, hex) {
				return String.fromCharCode(parseInt("0x" + hex));
			}).replace(/&#(\d+);/ig, function(all, number) {
				return String.fromCharCode(+number);
			});
		},
		
		/**
		 * HTML编码
		 * @param {String} html 
		 */
		encodeHTML: function(html) {
			return String(html).replace(/["<>& ]/g, function(all) {
				return "&" + htmlEncodeDict[all] + ";";
			});
		}
	};
	
	/**
	 * 解析器缓存
	 */
	var readerCaches = {};
	
	/**
	 * 是否注册了所有模板
	 */
	var registerAll = false;

	/**
	 * 格式化数据
	 * @param {String} template 模板字符串
	 * @param {Object} json 数据
	 */
	function format(template, json) {
		return template.replace(/(!?#)\{(.*?)\}/g, function(all, flag, key) {
			var text = json && (key in json) ? json[key] : ""; // undefined 则取 ""
			switch (flag) {
				case "#": return lib.encodeHTML(text);
				case "!#": return text;
			}
		});
	}

	/**
	 * 获得元素文本
	 * @param {Element} element
	 */
	function elementText(element) {
		if (!element || !element.tagName) return "";
		if (/^(input|textarea)$/i.test(element.tagName))
			return element.value;
		return lib.decodeHTML(element.innerHTML);
	}
	
	/**
	 * 构造模板的处理函数
	 * 不是JS块的规则
	 * 	非主流字符开头
	 * 		示例：汉字、#{value}、<div>
	 * 		正则：/^\s*[<>!#^&\u0000-\u0008\u007F-\uffff].*$/mg
	 * 	html标记结束，如：
	 * 		示例：>、src="1.gif" />
	 * 		正则：/^.*[<>]\s*$/mg
	 * 	没有“双引号、单引号、分号、逗号，大小括号”，不是else等单行语句、如：
	 * 		示例：hello world
	 * 		正则：/^(?!\s*(else|do|try|finally)\s*$)[^'":;,\[\]{}()\n\/]+$/mg
	 * 	属性表达式
	 * 		示例：a="12" b="45"、a='ab' b="cd"
	 * 		正则：/^(\s*(([\w-]+\s*=\s*"[^"]*")|([\w-]+\s*=\s*'[^']*')))+\s*$/mg
	 * 	样式表达式
	 * 		示例：div.focus{color: #fff;}、#btnAdd span{}
	 * 		正则：/^\s*([.#][\w-.]+(:\w+)?(\s*|,))*(?!(else|do|while|try|return)\b)[.#]?[\w-.*]+(:\w+)?\s*\{.*$/mg
	 * @param {String} template 模板字符
	 */
	function analyse(template) {
		var body = [], processItem = [];
		body.push("with(this){");
		body.push(template
			.replace(/[\r\n]+/g, "\n") // 去掉多余的换行，并且去掉IE中困扰人的\r
			.replace(/^\n+|\s+$/mg, "") // 去掉空行，首部空行，尾部空白
			.replace(/((^\s*[<>!#^&\u0000-\u0008\u007F-\uffff].*$|^.*[<>]\s*$|^(?!\s*(else|do|try|finally)\s*$)[^'":;,\[\]{}()\n\/]+$|^(\s*(([\w-]+\s*=\s*"[^"]*")|([\w-]+\s*=\s*'[^']*')))+\s*$|^\s*([.#][\w-.]+(:\w+)?(\s*|,))*(?!(else|do|while|try|return)\b)[.#]?[\w-.*]+(:\w+)?\s*\{.*$)\s?)+/mg, function(expression) { // 输出原文
				return ['_output_.push("',	expression
					.replace(/&none;/g, "") // 空字符
					.replace(/["'\\]/g, "\\$&") // 处理转义符
					.replace(/\n/g, "\\n") // 处理回车转义符
					.replace(/(!?#)\{(.*?)\}/g, function (all, flag, template) { // 变量替换
						template = template.replace(/\\n/g, "\n").replace(/\\([\\'"])/g, "$1") // 还原转义
						if (/^[a-z$][\w+$]+$/i.test(template) && !(/^(true|false|NaN|null|this)$/.test(template))) { // 单纯变量，加一个未定义保护
							template = format('typeof !#{0}=="undefined"?"":!#{0}', [template]);
						}
						return format('");_output_.push(_format_("!#{0}{0}",[!#{1}]));_output_.push("', [flag, template]);
					}),
				'");'].join("").replace(/_output_.push\(""\);/g, "");
			}));
		body.push("}");
		var result = new Function("_output_", "_format_", "helper", body.join(""));
		/* Debug Start */
		logger.log(String(result));
		/* Debug End */
		return result;
	}

	/**
	 * 格式化输出
	 * @param {String|Element} id 模板ID或是模板本身(非标识符将识别为模板本身)
	 * @param {Object} data 格式化的数据，默认为空字符串
	 * @param {Object} helper 附加数据(默认为模板对象)
	 */
	AceTemplate.format = function(id, data, helper) {
		if (!id) return "";
		var reader, element;
		if (typeof id == "object" && id.tagName) { // 如果是Dom对象
			element = id;
			id = element.getAttribute("id");
		}
		helper = helper || this; // 默认附加数据
		reader = readerCaches[id]; // 优先读取缓存
		if (!reader) { // 缓存中未出现
			if (/^[\w-]+$/.test(id)) { // 合法的标识符按id读取
				if (!element) {
					element = lib.g(id);
				}
				reader = this.register(id, element);
			} else {
				reader = analyse(id);
			} 			
		}
		var output = [];
		reader.call(data || "", output, format, helper);
		return output.join("");
	};
	
	/**
	 * 注册模板，如果没有参数则是注册所有script标签模板
	 * @param {String} id 模板ID
	 * @param {Element|String} target 模板对象或者是模板字符串，如果没有则默认获取id对应的DOM对象
	 */
	AceTemplate.register = function(id, target) {
		if (!arguments.length && !registerAll) { // 无参数并且没有注册过
			registerAll = true;
			var scripts = document.getElementsByTagName("script");
			for (var i = 0; i < scripts.length; i++) {
				var script = scripts[i];
				if (/^(text\/template)$/i.test(script.getAttribute("type"))) {
					var id = script.getAttribute("id");
					id && arguments.callee.call(this, id, script);
				}
			}
		}
		if (!id) return;
		if (readerCaches[id]) { // 如果已经注册
			return readerCaches[id];
		}
		if (typeof target != "string") {
			if (typeof target == "undefined") {
				target = lib.g(id);
			}
			target = elementText(target);
		}
		return readerCaches[id] = analyse(target);	
	};
	
	/**
	 * 注销模板
	 * @param {String} id 模板ID
	 */
	AceTemplate.unregister = function(id) {
		delete readerCaches[id];
	};
})();