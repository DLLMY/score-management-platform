import { useState } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  MessageCircle, 
  FileText,
  ExternalLink,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';

function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);

  const faqs = [
    {
      question: '如何添加新学生？',
      answer: '在左侧导航栏点击「学生管理」，然后点击页面右上角的「添加学生」按钮，填写学生基本信息（姓名、性别、班级、饭卡号等），最后点击「保存」即可完成添加。'
    },
    {
      question: '如何调整学生积分？',
      answer: '在学生列表中点击学生姓名进入详情页，或者在列表中找到对应学生后点击操作栏的「调整积分」按钮，输入调整的分数（正数为加分，负数为扣分）和备注说明，点击确认即可完成积分调整。'
    },
    {
      question: '积分规则如何设置？',
      answer: '进入「积分规则」页面，可以添加、编辑或删除积分规则。每个规则可以设置规则名称、所属分类、分数值、每日上限等参数。规则设置完成后，在给学生调整积分时可以选择对应的规则。'
    },
    {
      question: '如何使用MQTT调试工具？',
      answer: '进入「MQTT调试」页面，首先在「连接状态」标签页中点击「连接」按钮连接到MQTT服务器。连接成功后，可以在「消息发布」标签页发布消息，在「主题订阅」标签页订阅主题，在「消息日志」标签页查看消息记录，在「设备控制」标签页进行设备测试。'
    },
    {
      question: '手机箱如何验证学生积分？',
      answer: '当学生刷卡时，手机箱会通过MQTT发送查询消息到「phonebox/query」主题，后端系统收到查询后验证饭卡信息和积分，然后通过「phonebox/unlock/A」或「phonebox/unlock/B」主题返回授权结果。积分充足时允许开锁，积分不足时拒绝开锁。'
    },
    {
      question: '如何导入/导出积分规则？',
      answer: '在「积分规则」页面点击「导出规则」按钮可以将所有规则导出为JSON文件。点击「导入规则」按钮选择JSON文件可以批量导入规则。导入前请确保文件格式正确。'
    },
    {
      question: '排名等级是如何划分的？',
      answer: '排名等级可以在「排名规则」页面自定义设置。系统预置了四个等级：待达标(0-59分)、合格(60-79分)、优秀(80-89分)、卓越(90-100分)。您可以根据需要添加、修改或删除等级划分。'
    },
    {
      question: '数据分析页面展示哪些内容？',
      answer: '数据分析页面展示积分统计卡片（总学生数、平均分、最高分、最低分）、积分趋势图表、学生积分排行榜以及按班级统计的数据。帮助您全面了解积分分布情况。'
    }
  ];

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const docs = [
    { title: '系统使用指南', description: '详细介绍系统各项功能的使用方法', icon: BookOpen },
    { title: 'API接口文档', description: '后端API接口说明和使用示例', icon: FileText },
    { title: 'MQTT协议说明', description: '手机箱通信协议和消息格式', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">帮助中心</h1>
              <p className="text-sm text-gray-500">获取使用帮助和技术支持</p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索帮助文档..."
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {docs.map((doc, index) => {
            const Icon = doc.icon;
            return (
              <button
                key={index}
                className="p-4 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-3 group-hover:bg-primary-100 transition-colors">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div className="font-medium text-gray-900">{doc.title}</div>
                <div className="text-sm text-gray-500 mt-1">{doc.description}</div>
                <ExternalLink className="w-4 h-4 text-gray-400 mt-3 group-hover:text-primary-500 transition-colors" />
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">常见问题</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredFaqs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>未找到相关帮助内容</p>
              </div>
            ) : (
              filteredFaqs.map((faq, index) => (
                <div key={index}>
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900">{faq.question}</span>
                    {expandedFaq === index ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  {expandedFaq === index && (
                    <div className="px-6 pb-4">
                      <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary-500 to-indigo-600 rounded-xl p-6 text-white">
          <h3 className="font-semibold text-lg mb-4">联系支持</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm opacity-80">邮箱</div>
                <div className="font-medium">support@school.edu</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm opacity-80">电话</div>
                <div className="font-medium">400-123-4567</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm opacity-80">地址</div>
                <div className="font-medium">学校信息中心</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>系统版本: v1.0.0</p>
          <p className="mt-1">如有其他问题，请联系技术支持</p>
        </div>
      </div>
    </div>
  );
}

export default HelpCenter;
