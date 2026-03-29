const cheerio = require('cheerio');

export default async function handler(req, res) {
    const targetPath = req.query.path;

    if (!targetPath) {
        return res.status(400).json({ error: 'Path is required' });
    }

    try {
        const response = await fetch(`https://www.knowledgeboat.com${targetPath}`);
        if (!response.ok) throw new Error('Failed to fetch from source.');
        
        const html = await response.text();
        const $ = cheerio.load(html);

        const pageTitle = $('h1').first().text().trim() || 'Study Material';
        const markdownBody = $('.markdown-body');
        
        let generatedHtml = '';
        let pageType = '';
        let pageSubtitle = '';

        const chapterLinks = $('a').filter((i, el) => {
            const href = $(el).attr('href') || '';
            return href.includes('/solutions/') && $(el).find('h3').length > 0 && $(el).find('h2').length > 0;
        });

        if (chapterLinks.length > 0 && markdownBody.length === 0) {
            pageType = 'catalog';
            pageSubtitle = 'Select a Chapter';
            
            generatedHtml += '<div class="chapter-grid">';
            chapterLinks.each((i, el) => {
                const chapNum = $(el).find('h3').text().trim();
                const chapTitle = $(el).find('h2').text().trim();
                const href = $(el).attr('href');
                
                generatedHtml += `
                    <a href="${href}" class="chapter-card">
                        <div class="chap-num">${chapNum}</div>
                        <div class="chap-title">${chapTitle}</div>
                        <div class="chap-icon"><i class="fa-solid fa-arrow-right-long"></i></div>
                    </a>
                `;
            });
            generatedHtml += '</div>';
        } 
        else if (markdownBody.length > 0) {
            pageType = 'notes';
            
            $('h2').each((i, el) => {
                if (!$(el).closest('.markdown-body').length && !$(el).closest('a').length) {
                    pageSubtitle = $(el).text().trim();
                    return false;
                }
            });
            if (!pageSubtitle) pageSubtitle = 'Study Material';

            markdownBody.find('ins, script, style, .adsbygoogle, iframe, hr, a.anchor').remove();

            const sections = markdownBody.find('section');
            if (sections.length === 0) {
                generatedHtml = markdownBody.html();
            } else {
                sections.each((index, sec) => {
                    const sectionTitle = $(sec).find('h2').first().text().trim() || 'Exercise Section';
                    const isOpen = index === 0 ? 'open="true"' : '';
                    
                    generatedHtml += `
                        <details class="exercise-details" ${isOpen}>
                            <summary class="exercise-summary">
                                <span>${sectionTitle}</span><i class="fa-solid fa-angle-down"></i>
                            </summary>
                            <div class="exercise-content">
                    `;

                    let hasOpenQuestionBlock = false;
                    let isAnswerPhase = false;

                    $(sec).children().each((j, child) => {
                        const $child = $(child);
                        if ($child.is('h2')) return;

                        if ($child.is('h4') || $child.find('h4').length > 0) {
                            if (hasOpenQuestionBlock) generatedHtml += '</div>';
                            generatedHtml += '<div class="question-block">';
                            hasOpenQuestionBlock = true;
                            isAnswerPhase = false;
                            
                            const headingText = $child.is('h4') ? $child.text() : $child.find('h4').text();
                            generatedHtml += `<div class="question-heading">${headingText}</div>`;
                        } else if (hasOpenQuestionBlock) {
                            const text = $child.text().trim().toLowerCase();
                            if (text === 'answer' || text === 'answer:') {
                                isAnswerPhase = true;
                                generatedHtml += '<div class="answer-badge"><i class="fa-solid fa-check-circle"></i> Solution</div>';
                            } else {
                                $child.addClass(isAnswerPhase ? 'answer-text' : 'question-text');
                                let childHtml = $.html($child);
                                if ($child.is('table') || $child.find('table').length > 0) {
                                    childHtml = `<div class="table-responsive">${childHtml}</div>`;
                                }
                                generatedHtml += childHtml;
                            }
                        } else {
                            $child.addClass('question-text');
                            generatedHtml += $.html($child);
                        }
                    });

                    if (hasOpenQuestionBlock) generatedHtml += '</div>';
                    generatedHtml += `</div></details>`;
                });
            }
        } else {
            return res.status(400).json({ error: 'Content structure not recognized.' });
        }

        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
        
        return res.status(200).json({
            title: pageTitle,
            subtitle: pageSubtitle,
            type: pageType,
            html: generatedHtml
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
