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
	const processedLinksMap = new Map(
		results.map(result => [result.originalUrl, result.url.replace('cf://', '')])
	);
	
	// 保持原始顺序替换链接
	return vlessUrls.split('\n').map(line => 
		line.startsWith('cf://vless://') ? processedLinksMap.get(line) : line
	).join('\n');
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
			
			// 重新排序参数，确保 host 在 type 之后
			const urlParts = modifiedUrl.split('?');
			if (urlParts.length > 1) {
				const baseUrl = urlParts[0];
				const params = new URLSearchParams(urlParts[1]);
				const orderedParams = new URLSearchParams();
				
				// 首先添加除 type 和 host 之外的参数
				for (const [key, value] of params.entries()) {
					if (key !== 'type' && key !== 'host') {
						orderedParams.append(key, value);
					}
				}
				
				// 添加 type 参数（如果存在）
				if (params.has('type')) {
					orderedParams.append('type', params.get('type'));
				}
				
				// 最后添加 host 参数
				orderedParams.append('host', originalDomain);
				
				modifiedUrl = `${baseUrl}?${orderedParams.toString()}`;
			} else {
				modifiedUrl = `${modifiedUrl}?host=${originalDomain}`;
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