const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('护薪宝后端服务正常运行中！');
});

// ========== RAG 检索函数==========

async function searchLaws(query, topK = 3) {
  try {
    const response = await axios.post('http://127.0.0.1:5000/search', {
      query,
      top_k: topK
    });
    return response.data;
  } catch (error) {
    console.error('调用 Python RAG 服务失败:', error.message);
    throw error;
  }
}
// ========== RAG 智能问答接口 ==========
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: '问题不能为空' });
    }

    let laws;
    try {
      laws = await searchLaws(message, 3);
      console.log(`检索到 ${laws.length} 条相关法条`);
    } catch (searchErr) {
      console.error('法条检索失败，降级处理:', searchErr);
      laws = [];
    }

    let lawContext = '';
    if (laws.length > 0) {
      lawContext = laws.map(l => `${l.title}：${l.content}`).join('\n\n');
    } else {
      lawContext = '暂无直接相关法条，请基于通用劳动法知识回答，并建议用户咨询当地劳动监察部门或专业律师。';
    }

    const systemPrompt = `你是一位专业的劳动法顾问，专门帮助外卖骑手、网约车司机等新就业形态劳动者解答法律问题。你的回答必须严格基于【参考资料】中的法条内容，不可编造法律条文。

【参考资料】
${lawContext}

【回答要求】
1. 先用1-2句大白话解释用户的核心疑问。
2. 引用相关法条（注明出处）。
3. 给出清晰的行动建议（第一步做什么、第二步做什么）。
4. 语气友好、共情，开头可以说"别担心，我们来看看怎么办。"`;

    const response = await axios.post(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.3,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BIGMODEL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;

    res.json({
      reply: aiReply,
      references: laws.map(l => ({
        title: l.title,
        content: l.content,
        source: l.source
      }))
    });

  } catch (error) {
    console.error('RAG问答失败:', error.response?.data || error.message);
    res.status(500).json({ error: 'AI服务暂时不可用，请稍后重试' });
  }
});
//文书接口
app.post('/api/document', async (req, res) => {
  try {
    const { docType, applicantName, applicantPhone, companyName, facts } = req.body;
    
    if (!docType || !applicantName || !companyName || !facts) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    // 文书生成 Prompt
    const systemPrompt = `你是一位专业的法律文书撰写助手，专门帮助劳动者起草劳动仲裁相关文书。请根据用户提供的信息，生成一份格式规范、逻辑清晰的《劳动仲裁申请书》正文部分。
    
要求：
1. 包含“申请人信息”“被申请人信息”“仲裁请求”“事实与理由”四个部分。
2. 语言正式但通俗易懂，便于劳动者直接使用。
3. 在末尾注明“本文件由AI辅助生成，提交前建议咨询专业律师”。

【用户信息】
- 申请人姓名：${applicantName}
- 联系电话：${applicantPhone}
- 被申请人公司名称：${companyName}
- 事实与理由概述：${facts}`;

    const response = await axios.post(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请生成一份关于“${facts}”的劳动仲裁申请书。` }
        ],
        temperature: 0.3,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BIGMODEL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const documentContent = response.data.choices[0].message.content;
    
    res.json({
      success: true,
      document: documentContent
    });

  } catch (error) {
    console.error('文书生成失败:', error.response?.data || error.message);
    res.status(500).json({ error: '文书生成失败，请稍后重试' });
  }
});
//法条接口
app.get('/api/law/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    if (!keyword) {
      return res.status(400).json({ error: '请提供搜索关键词' });
    }

    // 1. 使用 RAG 检索相关法条（Top 3）
    let laws;
    try {
      laws = await searchLaws(keyword, 3);
    } catch (err) {
      console.error('法条检索失败:', err);
      laws = [];
    }

    if (laws.length === 0) {
      return res.json({ laws: [] });
    }

    // 2. 为每条法条生成白话解读（可选，提升用户体验）
    // 注意：为节约时间，也可以直接返回法条原文，解读在前端显示时再调用 AI，但此处一并生成更专业
    const enhancedLaws = await Promise.all(laws.map(async (law) => {
      try {
        const explainPrompt = `请用一句通俗易懂的大白话解释以下法条的含义，让外卖骑手、网约车司机等劳动者能听懂：\n${law.content}`;
        const response = await axios.post(
          'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          {
            model: 'glm-4-flash',
            messages: [{ role: 'user', content: explainPrompt }],
            temperature: 0.3
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.BIGMODEL_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        return {
          ...law,
          plainExplanation: response.data.choices[0].message.content
        };
      } catch (e) {
        return { ...law, plainExplanation: '暂无白话解读' };
      }
    }));

    res.json({ laws: enhancedLaws });
  } catch (error) {
    console.error('法条检索失败:', error);
    res.status(500).json({ error: '服务异常' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ 后端服务已启动：监听端口 ${PORT}`);
});