export async function cf_ips(vlessUrls) {
	const response = await fetch("https://www.wetest.vip/api/cf2dns/get_cloudflare_ip");
	const data = await response.json();
	
	if (!data.info) {
		throw new Error("无法获取 Cloudflare IP 信息");
	}

	const allIPs = {
		CM: data.info.CM || [],
		CU: data.info.CU || [],
		CT: data.info.CT || []
	};

	// 处理 cf:// 链接
	const results = processLINK(allIPs, vlessUrls);
	
	// 创建映射，key是原始URL，value是所有运营商链接的数组
	const processedLinksMap = new Map();
	results.forEach(result => {
		if (!processedLinksMap.has(result.originalUrl)) {
			processedLinksMap.set(result.originalUrl, []);
		}
		processedLinksMap.get(result.originalUrl).push(result.url.replace('cf://', ''));
	});
	
	// 修改返回逻辑，将 cf:// 节点放到最后
	const normalLines = [];
	const cfLines = [];
	
	vlessUrls.split('\n').forEach(line => {
		if (line.startsWith('cf://vless://')) {
			// cf 节点的所有运营商版本
			cfLines.push(...processedLinksMap.get(line));
		} else {
			normalLines.push(line);
		}
	});
	
	// 合并普通节点和 cf 节点
	return [...normalLines, ...cfLines].join('\n');
}

function processLINK(allIPs, LINK) {
	const urls = LINK.split('\n').filter(url => url.startsWith('cf://vless://'));
	
	const results = [];
	for (const url of urls) {
		const vlessUrl = url.substring(5);
		
		const match = vlessUrl.match(/@([^:]+):/);
		if (!match) continue;
		
		const originalDomain = match[1];
		
		// 遍历每个运营商的所有 IP
		for (const [isp, ipList] of Object.entries(allIPs)) {
			for (const ipInfo of ipList) {
				const newUrl = vlessUrl.replace(
					`@${originalDomain}:`,
					`@${ipInfo.ip}:`
				);
				
				let modifiedUrl = newUrl;
				const ispLabel = `${isp}-${ipInfo.colo}`;
				
				// 在 type 参数后添加 host 参数
				const typeIndex = modifiedUrl.indexOf('type=');
				if (typeIndex !== -1) {
					const afterType = modifiedUrl.indexOf('&', typeIndex);
					if (afterType !== -1) {
						modifiedUrl = modifiedUrl.slice(0, afterType) + 
									`&host=${originalDomain}` + 
									modifiedUrl.slice(afterType);
					} else {
						modifiedUrl = modifiedUrl + `&host=${originalDomain}`;
					}
				} else if (modifiedUrl.includes('?')) {
					modifiedUrl = modifiedUrl + `&host=${originalDomain}`;
				} else {
					modifiedUrl = modifiedUrl + `?host=${originalDomain}`;
				}
				
				// 处理备注部分
				const hashIndex = modifiedUrl.indexOf('#');
				if (hashIndex !== -1) {
					modifiedUrl = modifiedUrl.slice(0, hashIndex + 1) + 
								ispLabel + 
								modifiedUrl.slice(hashIndex + 1);
				} else {
					modifiedUrl = modifiedUrl + '#' + ispLabel;
				}
				
				results.push({
					isp,
					url: `cf://${modifiedUrl}`,
					originalUrl: url
				});
			}
		}
	}
	
	return results;
}