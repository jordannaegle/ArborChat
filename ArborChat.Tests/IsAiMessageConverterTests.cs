using ArborChat.Converters;
using System.Globalization;

namespace ArborChat.Tests
{
    public class IsAiMessageConverterTests
    {
        private readonly IsAiMessageConverter _converter;

        public IsAiMessageConverterTests()
        {
            _converter = new IsAiMessageConverter();
        }

        [Theory]
        [InlineData("ai", true)]
        [InlineData("user", false)]
        [InlineData("system", false)]
        [InlineData(null, false)]
        [InlineData("", false)]
        [InlineData("AI", true)]
        public void Convert_ReturnsCorrectBoolean(string? role, bool expected)
        {
            // Act
            var result = _converter.Convert(role, typeof(bool), null, CultureInfo.CurrentCulture);

            // Assert
            Assert.Equal(expected, result);
        }

        [Fact]
        public void ConvertBack_ThrowsNotImplementedException()
        {
            // Assert
            Assert.Throws<NotImplementedException>(() => _converter.ConvertBack(true, typeof(string), null, CultureInfo.CurrentCulture));
        }
    }
}
