export async function cf_ips(vlessUrls) {
	const response = await fetch("https://www.wetest.vip/api/cf2dns/get_cloudflare_ip");
	const data = await response.json();
	
	if (!data.info) {
		throw new Error("无法获取 Cloudflare IP 信息");
	}

	const bestIPs = {
		CM: getBestIP(data.info.CM),
		CU: getBestIP(data.info.CU),
		CT: getBestIP(data.info.CT)
	};

	console.log("最佳节点列表:", bestIPs);
	
	// 处理 cf:// 链接
	const results = processLINK(bestIPs, vlessUrls);
	
	// 创建映射，key是原始URL，value是包含三个运营商链接的数组
	const processedLinksMap = new Map();
	results.forEach(result => {
		if (!processedLinksMap.has(result.originalUrl)) {
			processedLinksMap.set(result.originalUrl, []);
		}
		processedLinksMap.get(result.originalUrl).push(result.url.replace('cf://', ''));
	});
	
	// 保持原始顺序替换链接
	return vlessUrls.split('\n').map(line => {
		if (line.startsWith('cf://vless://')) {
			// 如果是需要处理的链接，返回三个运营商的版本
			return processedLinksMap.get(line).join('\n');
		}
		return line;
	}).join('\n');
}

function getBestIP(ipList) {
	if (!ipList || ipList.length === 0) {
		return null;
	}

	return ipList.reduce((best, current) => {
		const currentScore = current.bandwidth - (current.delay / 100);
		const bestScore = best.bandwidth - (best.delay / 100);
		return currentScore > bestScore ? current : best;
	});
}

function processLINK(bestIPs, LINK) {
	const urls = LINK.split('\n').filter(url => url.startsWith('cf://vless://'));
	
	const results = [];
	for (const url of urls) {
		const vlessUrl = url.substring(5);
		
		const match = vlessUrl.match(/@([^:]+):/);
		if (!match) continue;
		
		const originalDomain = match[1];
		
		for (const [isp, ipInfo] of Object.entries(bestIPs)) {
			if (!ipInfo) continue;
			
			const newUrl = vlessUrl.replace(
				`@${originalDomain}:`,
				`@${ipInfo.ip}:`
			);
			
			let modifiedUrl = newUrl;
			const ispLabel = `${isp}-${ipInfo.colo}`;
			
			if (newUrl.includes('&path=')) {
				modifiedUrl = newUrl.replace('&path=', `&path=/${ispLabel}`);
			} else if (newUrl.includes('?path=')) {
				modifiedUrl = newUrl.replace('?path=', `?path=/${ispLabel}`);
			}
			
			// 在 type 参数后添加 host 参数
			const typeIndex = modifiedUrl.indexOf('type=');
			if (typeIndex !== -1) {
				// 找到 type 参数后的 & 或字符串结尾
				const afterType = modifiedUrl.indexOf('&', typeIndex);
				if (afterType !== -1) {
					// 如果 type 后面还有其他参数
					modifiedUrl = modifiedUrl.slice(0, afterType) + 
								`&host=${originalDomain}` + 
								modifiedUrl.slice(afterType);
				} else {
					// 如果 type 是最后一个参数
					modifiedUrl = modifiedUrl + `&host=${originalDomain}`;
				}
			} else if (modifiedUrl.includes('?')) {
				// 如果没有 type 参数但有其他参数
				modifiedUrl = modifiedUrl + `&host=${originalDomain}`;
			} else {
				// 如果没有任何参数
				modifiedUrl = modifiedUrl + `?host=${originalDomain}`;
			}
			
			results.push({
				isp,
				url: `cf://${modifiedUrl}`,
				originalUrl: url
			});
		}
	}
	
	return results;
}